import {bossClaims} from '@/lib/trash-boss-claims';
import {communityState} from '@/lib/community-local';
import {resolvedPrizeSettings} from '@/lib/prize-settings';
import {trackerHunts} from '@/lib/site-tracker';
import {apiError,requireTrackerAdmin} from '@/lib/site-db';
export async function GET(request:Request){try{
 const state=await communityState(),settings=resolvedPrizeSettings(state.prizeSettings);
 if(settings.trashBossesEnabled!==true){try{await requireTrackerAdmin(request);}catch{return Response.json({error:'Not available'},{status:404,headers:{'Cache-Control':'private, no-store'}});}}
 const hunts=await trackerHunts(),claims=await bossClaims(settings.leaderboardStart);
 return Response.json({claims,settings,hunts:hunts.map(h=>({id:h.id,title:h.title,source:h.source,casino:h.casino,phase:h.phase,startCost:h.startCost,entries:h.entries.filter(e=>e.call_id&&!String(e.call_id).startsWith('manual:')).map(e=>({id:e.id,call_id:e.call_id,username:e.username,slot_name:e.slot_name,status:e.status,bet_size:e.bet_size,payout:e.payout,updated_at:e.updated_at,payout_recorded_at:e.payout_recorded_at}))}))},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return apiError(e);}}
