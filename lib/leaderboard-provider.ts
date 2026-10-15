import "server-only";
import {serverPrizeSettings} from "./server-prize-settings";
import {leaderboardPeriods,affiliateStandings} from "./leaderboard-data";
type ProviderRows=Record<string,unknown>[];
const cacheKey=Symbol.for("trashguy.roulo.reads.v2");
type Reads={cache:Map<string,{expires:number;rows:Promise<ProviderRows>}>;fresh:Map<string,Promise<ProviderRows>>;retryAt:number};
const holder=globalThis as typeof globalThis&{[cacheKey]?:Reads};
/** Shared by reports, profile and sync. Fresh eligibility reads never use cached rows. */
export async function providerRows(start:string,end:string,options:{fresh?:boolean;weighted?:boolean}={}):Promise<ProviderRows> {
  if(!process.env.ROULO_API_KEY)throw Error("The provider leaderboard is not configured.");
  const state=holder[cacheKey]??={cache:new Map(),fresh:new Map(),retryAt:0};
  const key=start+":"+end+":"+(options.weighted!==false);
  const old=state.cache.get(key);
  if(!options.fresh&&old&&old.expires>Date.now())return old.rows;
  if(state.retryAt>Date.now())throw Error("PROVIDER_RATE_LIMIT");
  const pending=state.fresh.get(key);
  if(pending)return pending;
  const rows=(async()=>{
    const url=new URL("https://api.roulobets.com/v1/external/affiliates");
    url.search=new URLSearchParams({start_at:start,end_at:end,key:process.env.ROULO_API_KEY!,weighted:String(options.weighted!==false)}).toString();
    const response=await fetch(url,{...(options.fresh?{cache:"no-store" as const}:{cache:"force-cache" as const,next:{revalidate:60}}),signal:AbortSignal.timeout(8000)});
    if(response.status===429) {
      const header=response.headers.get("retry-after"),seconds=header?Number(header):NaN;
      const wait=Number.isFinite(seconds)?seconds*1000:header?Date.parse(header)-Date.now():60000;
      state.retryAt=Date.now()+Math.max(60000,Math.min(Number.isFinite(wait)?wait:60000,300000));
      throw Error("PROVIDER_RATE_LIMIT");
    }
    if(!response.ok)throw Error("The provider leaderboard is temporarily unavailable.");
    const body=await response.json();
    const values=[body,body?.affiliates,body?.data,body?.results,body?.players,body?.users,body?.data?.affiliates,body?.data?.results];
    const result=values.find(Array.isArray);
    if(!result)throw Error("The provider returned an unrecognised leaderboard.");
    return result as ProviderRows;
  })();
  if(options.fresh)state.fresh.set(key,rows);
  else {if(state.cache.size>=32)state.cache.delete(state.cache.keys().next().value!);state.cache.set(key,{expires:Date.now()+60000,rows});}
  try{return await rows;}
  catch(error){if(!options.fresh&&state.cache.get(key)?.rows===rows&&!(error instanceof Error&&error.message==="PROVIDER_RATE_LIMIT"))state.cache.delete(key);throw error;}
  finally{if(options.fresh&&state.fresh.get(key)===rows)state.fresh.delete(key);}
}
export async function leaderboardResults(selected?:string|null){
 const settings=await serverPrizeSettings(),periods=leaderboardPeriods(settings),period=periods.find(p=>p.start===(selected||settings.leaderboardStart));
 if(!period)throw Error('Choose an available leaderboard period.');
 if(!process.env.ROULO_API_KEY)throw Error('The provider leaderboard is not configured.');
 const affiliates=await providerRows(period.start,period.end);
 return {...affiliateStandings(affiliates),affiliates,period,periods,weighting:settings.leaderboardWeighting||'',updatedAt:new Date().toISOString()};
}
