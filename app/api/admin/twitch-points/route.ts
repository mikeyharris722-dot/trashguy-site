import {apiError,requireTrackerAdmin} from '@/lib/site-db';
import {checkSubscription,disablePoints,invite,pointsConfig,pointsStatus,rewards,savePoints,subscribe} from '@/lib/twitch-points-server';
import {pointsSettings} from '@/lib/twitch-points-security';
import {productionCommand,queueLocalScotland} from '@/lib/claw-production-server';
import {localCommunity} from '@/lib/community-store';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){try{await requireTrackerAdmin(request);return Response.json(await pointsStatus(),{headers});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 const actor=await requireTrackerAdmin(request),body=await request.json();
 if(body.action==='check'){await checkSubscription();return Response.json(await pointsStatus(),{headers});}
 if(body.action==='invite')return Response.json(await invite(),{headers});
 if(body.action==='rewards')return Response.json({rewards:await rewards()},{headers});
 if(body.action==='subscribe')return Response.json({status:await subscribe()},{headers});
 if(body.action==='stop'){await productionCommand(actor,'stop');return Response.json({ok:true},{headers});}
 if(body.action==='local-test'){const volume=Number(body.volume);if(!Number.isFinite(volume)||volume<0||volume>1)throw Error('Choose a valid volume.');await queueLocalScotland(volume);return Response.json({ok:true},{headers});}
 if(body.action==='save'){
  const next=pointsSettings(body),config=await pointsConfig();
  if(next.enabled){if(localCommunity())throw Error('Live activation is disabled in local preview. Use the local queue test.');if(!config.tokens||config.subscription_status!=='enabled')throw Error('Connect Twitch and verify its event subscription first.');const available=await rewards();if(!available.some((reward:{id:string;enabled:boolean})=>reward.id===next.reward_id&&reward.enabled))throw Error('Choose an enabled reward from this Twitch channel.');}
  await savePoints(next);if(!next.enabled)await disablePoints();
  return Response.json({ok:true},{headers});
 }
 throw Error('Unknown channel-point action.');
}catch(error){return apiError(error);}}
