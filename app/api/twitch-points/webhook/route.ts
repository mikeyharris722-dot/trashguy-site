import {REDEMPTION_TYPE,verifyWebhook} from '@/lib/twitch-points-security';
import {enqueueRedemption,pointsConfig,savePoints} from '@/lib/twitch-points-server';
export const runtime='nodejs';
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')||0)>65536)return new Response(null,{status:413});
 const body=await request.text();if(body.length>65536)return new Response(null,{status:413});
 try{if(!verifyWebhook(request.headers,body))return new Response(null,{status:403});}catch{return new Response(null,{status:503});}
 try{
  const data=JSON.parse(body),subscription=data.subscription;
  const config=await pointsConfig();
  if(subscription?.type!==REDEMPTION_TYPE||subscription?.version!=='1'||subscription?.condition?.broadcaster_user_id!==config.broadcaster_id)return new Response(null,{status:403});
  const type=request.headers.get('twitch-eventsub-message-type');
  if(type==='webhook_callback_verification'){
   if(typeof data.challenge!=='string'||data.challenge.length>1000)return new Response(null,{status:400});
   await savePoints({subscription_id:subscription.id,subscription_status:'enabled'});
   return new Response(data.challenge,{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
  }
  if(subscription.id!==config.subscription_id)return new Response(null,{status:403});
  if(type==='revocation'){await savePoints({enabled:false,subscription_status:subscription.status});return new Response(null,{status:204});}
  if(type!=='notification')return new Response(null,{status:400});
  const event=data.event;
  if(typeof event?.id!=='string'||event.id.length>200||event.broadcaster_user_id!==config.broadcaster_id||typeof event.reward?.id!=='string')return new Response(null,{status:400});
  if(event.reward.id!==config.reward_id)return new Response(null,{status:204});
  await enqueueRedemption(event.id,String(event.user_login||event.user_name||'viewer'),event.broadcaster_user_id,event.reward.id);
  return new Response(null,{status:204});
 }catch{return new Response(null,{status:503});}
}
