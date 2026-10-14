import 'server-only';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {siteDb} from './site-db';
import {localCommunity} from './community-store';
import {communityState} from './community-local';
import {resolvedPrizeSettings} from './prize-settings';
import {defaultWeeklyWager,weeklyProgress,weeklyEndExclusive} from './weekly-wager';
import {providerRows} from './leaderboard-provider';
export type WeeklyClaim={id:string;username:string;tier_id:string;period_start:string;period_end:string;target:number;amount:number;weighted_wager:number;created_at:string};
const file=path.join(process.cwd(),'.local','weekly-wager-claims.json'),lock=Symbol.for('trashguy.weekly.claims'),holder=globalThis as typeof globalThis&{[lock]?:Promise<unknown>};
export async function weeklySettings(){return resolvedPrizeSettings((await communityState()).prizeSettings).weeklyWager||defaultWeeklyWager;}
async function localClaims():Promise<WeeklyClaim[]>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return [];}}
export async function weeklyClaims(username:string){if(localCommunity())return (await localClaims()).filter(c=>c.username===username).sort((a,b)=>b.created_at.localeCompare(a.created_at));const {data,error}=await siteDb().from('weekly_wager_claims').select('id,username,tier_id,period_start,period_end,target,amount,weighted_wager,created_at').eq('username',username).order('created_at',{ascending:false}).limit(50);if(error){if(error.code==='42P01'||error.code==='PGRST205')return [];throw Error('Could not load weekly reward history.');}return (data||[]) as WeeklyClaim[];}
export async function weeklyWeighted(username:string,start:string,end:string){
 const {data,error}=await siteDb().from('roulo_links').select('roulo_username').eq('twitch_username',username).limit(2);
 if(error)throw Error('Could not check your linked Roulo account.');
 if(data?.length!==1||!data[0].roulo_username)return {linked:false,weighted:0,account:""};
 if(Date.now()<Date.parse(start+'T00:00:00Z'))return {linked:true,weighted:0,account:String(data[0].roulo_username)};
 const account=String(data[0].roulo_username).trim().toLowerCase(),rows=await providerRows(start,end),matches=rows.filter(p=>String(p.username||p.name||p.display_name||'').trim().toLowerCase()===account);
 if(matches.length>1)throw Error('Your provider account matched more than once. Contact an admin.');
 if(!matches.length)return {linked:true,weighted:0};
 const amount=matches[0].weighted_wagered_amount??matches[0].weightedWageredAmount??matches[0].weighted_wagered;
 if(amount===null||amount===undefined||!Number.isFinite(Number(amount))||Number(amount)<0)throw Error('Roulo did not supply a valid weighted wager. Please retry.');
 return {linked:true,weighted:Number(amount),account:String(data[0].roulo_username)};
}
export async function claimWeekly(username:string,tierId:string){
 const run=async()=>{const settings=await weeklySettings();if(!settings.enabled)throw Error('Weekly wager rewards are deactivated.');if(Date.now()<Date.parse(settings.start+'T00:00:00Z'))throw Error('This weekly period has not started.');const target=settings.targets.find(t=>t.id===tierId);if(!target)throw Error('Choose a valid weekly target.');
 const existing=(await weeklyClaims(username)).find(c=>c.period_start===settings.start&&c.tier_id===tierId);if(existing)return existing.id;
 const progress=await weeklyWeighted(username,settings.start,weeklyEndExclusive(settings.end));if(!progress.linked)throw Error('Link your Roulo account in Your profile first.');if(!weeklyProgress(progress.weighted,target.target).eligible)throw Error('Your weighted wager has not reached this target.');
 if(!localCommunity()){const {data,error}=await siteDb().rpc('claim_weekly_wager',{p_username:username,p_tier:tierId,p_start:settings.start,p_end:settings.end,p_target:target.target,p_amount:target.reward,p_weighted:progress.weighted});if(error)throw Error(error.code==='PGRST202'?'Weekly reward setup is not ready yet.':error.message);return String(data);}
 const latest=await weeklySettings();if(JSON.stringify(latest)!==JSON.stringify(settings))throw Error('Weekly settings changed. Refresh and retry.');const claims=await localClaims(),id=randomUUID();claims.push({id,username,tier_id:tierId,period_start:settings.start,period_end:settings.end,target:target.target,amount:target.reward,weighted_wager:progress.weighted,created_at:new Date().toISOString()});await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+id+'.tmp';await fs.writeFile(tmp,JSON.stringify(claims));await fs.rename(tmp,file);return id;};
 if(!localCommunity())return run();const job=(holder[lock]||Promise.resolve()).catch(()=>{}).then(run);holder[lock]=job;return job;
}
export async function ensureWeeklySetup(){if(localCommunity())return;const {error}=await siteDb().from('weekly_wager_claims').select('id').limit(0);if(error)throw Error('Complete the weekly reward database setup before activating it.');}
