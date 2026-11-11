import {discordLeaderboardPayload} from '@/lib/discord-leaderboard-payload.mjs';
import {leaderboardResults} from '@/lib/leaderboard-provider';
export const runtime='nodejs';
export async function GET(request:Request){try{
 const params=new URL(request.url).searchParams;
 const discord=params.get('format')==='discord';
 const result=await leaderboardResults(discord?null:params.get('period'));
 if(discord)return Response.json(discordLeaderboardPayload({...result,success:true}),{headers:{'Cache-Control':'no-store'}});
 const affiliates=result.affiliates;
 return Response.json({success:true,affiliates,players:result.players.slice(0,10),period:result.period,periods:result.periods,currentStart:result.currentStart,weighting:result.weighting,updatedAt:result.updatedAt},{headers:{'Cache-Control':'no-store'}});
}catch(error){const limited=error instanceof Error&&error.message==='PROVIDER_RATE_LIMIT';return Response.json({success:false,error:limited?'Roulo is limiting requests. The leaderboard will retry automatically within a minute.':'The provider leaderboard is temporarily unavailable. Please retry.'},{status:limited?429:503,headers:{'Cache-Control':'no-store'}});}}
