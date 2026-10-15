import {leaderboardResults} from '@/lib/leaderboard-provider';
export const runtime='nodejs';
export async function GET(request:Request){try{
 const result=await leaderboardResults(new URL(request.url).searchParams.get('period'));
 const affiliates=result.affiliates;
 return Response.json({success:true,affiliates,players:result.players.slice(0,10),period:result.period,periods:result.periods,weighting:result.weighting,updatedAt:result.updatedAt},{headers:{'Cache-Control':'no-store'}});
}catch(error){const limited=error instanceof Error&&error.message==='PROVIDER_RATE_LIMIT';return Response.json({success:false,error:limited?'Roulo is limiting requests. The leaderboard will retry automatically within a minute.':'The provider leaderboard is temporarily unavailable. Please retry.'},{status:limited?429:503,headers:{'Cache-Control':'no-store'}});}}
