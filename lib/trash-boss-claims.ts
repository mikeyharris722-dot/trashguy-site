import 'server-only';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {localCommunity} from './community-store';
import {siteDb} from './site-db';
import {communityState} from './community-local';
import {resolvedPrizeSettings} from './prize-settings';
import {defaultBossTargets,trashBossProgress} from './trash-bosses';
import {trackerHunts} from './site-tracker';
export type BossClaim={username:string;boss:number;periodStart:string;periodEnd:string;amount:number;id:string;paid?:boolean};
const filename=path.join(process.cwd(),'.local','trash-boss-claims.json');
const lock=Symbol.for('trashguy.boss.claims');const holder=globalThis as typeof globalThis&{[lock]:Promise<unknown>|undefined};
async function localClaims():Promise<BossClaim[]>{try{return JSON.parse(await fs.readFile(filename,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return [];}}
export async function bossClaims(start:string){if(localCommunity())return (await localClaims()).filter(c=>c.periodStart===start);const {data,error}=await siteDb().from('trash_boss_claims').select('id,username,boss,period_start,period_end,amount').eq('period_start',start);if(error){if(error.code==='PGRST205'||error.code==='42P01')return [];throw Error(error.message);}return (data||[]).map(c=>({id:c.id,username:c.username,boss:c.boss,periodStart:c.period_start,periodEnd:c.period_end,amount:Number(c.amount)}));}
export async function claimBoss(username:string,boss:number){
 if(!Number.isInteger(boss)||boss<0||boss>2)throw Error('Choose a valid boss.');
 const settings=resolvedPrizeSettings((await communityState()).prizeSettings),targets=settings.trashBosses||defaultBossTargets;
 if(settings.trashBossesEnabled!==true)throw Error("Trash Bosses is deactivated. Reward claims are disabled.");
 if(Date.now()<Date.parse(settings.leaderboardStart+'T00:00:00Z'))throw Error('This leaderboard period has not started.');
 if(targets[boss].reward<=0)throw Error('This boss has no cash reward.');
 if(!localCommunity()){const {data,error}=await siteDb().rpc('claim_trash_boss',{p_username:username,p_boss:boss,p_start:settings.leaderboardStart,p_end:settings.leaderboardEnd,p_target:targets[boss].target,p_amount:targets[boss].reward});if(error)throw Error(error.code==='PGRST202'?'Reward setup is not ready yet.':error.message);return String(data);}
 const run=(holder[lock]||Promise.resolve()).catch(()=>{}).then(async()=>{
  const latest=resolvedPrizeSettings((await communityState()).prizeSettings);if(latest.trashBossesEnabled!==true)throw Error("Trash Bosses is deactivated. Reward claims are disabled.");
  const claims=await localClaims(),old=claims.find(c=>c.username===username&&c.boss===boss&&c.periodStart===settings.leaderboardStart);if(old)return old.id;
  const player=trashBossProgress(await trackerHunts(),settings.leaderboardStart,settings.leaderboardEnd,targets).find(p=>p.key===username);
  if(!player||player.total<targets[boss].target)throw Error('Your called-slot winnings have not reached this target.');
  const id=randomUUID();claims.push({id,username,boss,periodStart:settings.leaderboardStart,periodEnd:settings.leaderboardEnd,amount:targets[boss].reward});await fs.mkdir(path.dirname(filename),{recursive:true});const tmp=filename+'.'+id+'.tmp';await fs.writeFile(tmp,JSON.stringify(claims));await fs.rename(tmp,filename);return id;
 });holder[lock]=run;return run;
}

export async function ensureBossRewardSetup(){
 if(localCommunity())return;
 const [claims,dates]=await Promise.all([siteDb().from('trash_boss_claims').select('id').limit(0),siteDb().from('site_tracker_entries').select('payout_recorded_at').limit(0)]);
 if(claims.error||dates.error)throw Error('Complete the Trash Bosses reward setup before activating it. You can still save values while it is deactivated.');
}
