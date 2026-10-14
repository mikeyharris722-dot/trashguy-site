import 'server-only';
import {communityState} from './community-local';
import {resolvedPrizeSettings} from './prize-settings';
import {leaderboardPeriods,affiliateStandings} from './leaderboard-data';
const cacheKey=Symbol.for('trashguy.leaderboard.affiliates');
type ProviderRows=Record<string,unknown>[];
const holder=globalThis as typeof globalThis&{[cacheKey]?:Map<string,{expires:number;rows:Promise<ProviderRows>}>};
async function providerRows(start:string,end:string):Promise<ProviderRows>{
 const cache=holder[cacheKey]??=new Map(),key=start+':'+end,old=cache.get(key);
 if(old&&old.expires>Date.now())return old.rows;
 const rows=(async()=>{let last:unknown;for(let attempt=0;attempt<2;attempt++){try{const url=new URL('https://api.roulobets.com/v1/external/affiliates');url.search=new URLSearchParams({start_at:start,end_at:end,key:process.env.ROULO_API_KEY!,weighted:'true'}).toString();const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(response.status===429)throw Error('PROVIDER_RATE_LIMIT');if(!response.ok)throw Error('The provider leaderboard is temporarily unavailable.');const data=await response.json(),rows=Array.isArray(data)?data:data.affiliates;if(!Array.isArray(rows))throw Error('The provider returned an unrecognised leaderboard.');return rows as ProviderRows;}catch(error){last=error;if(error instanceof Error&&error.message==='PROVIDER_RATE_LIMIT')throw error;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,500));}}throw last;})();
 cache.set(key,{expires:Date.now()+60000,rows});
 try{return await rows;}catch(error){if(!(error instanceof Error&&error.message==='PROVIDER_RATE_LIMIT'))cache.delete(key);throw error;}
}
export async function leaderboardResults(selected?:string|null){
 const settings=resolvedPrizeSettings((await communityState()).prizeSettings),periods=leaderboardPeriods(settings),period=periods.find(p=>p.start===(selected||settings.leaderboardStart));
 if(!period)throw Error('Choose an available leaderboard period.');
 if(!process.env.ROULO_API_KEY)throw Error('The provider leaderboard is not configured.');
 const affiliates=await providerRows(period.start,period.end);
 return {...affiliateStandings(affiliates),affiliates,period,periods,weighting:settings.leaderboardWeighting||'',updatedAt:new Date().toISOString()};
}
