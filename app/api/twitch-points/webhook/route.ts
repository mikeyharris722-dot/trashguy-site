import {CHAT_TYPE,isStopCommand,REDEMPTION_TYPE,verifyWebhook} from '@/lib/twitch-points-security';
import {disablePoints,enqueueRedemption,pointsConfig,savePoints,stopFromChat} from '@/lib/twitch-points-server';
export const runtime='nodejs';
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')||0)>65536)return new Response(null,{status:413});
 const body=await request.text();if(body.length>65536)return new Response(null,{status:413});
 try{if(!verifyWebhook(request.headers,body))return new Response(null,{status:403});}catch{return new Response(null,{status:503});}
 try{
  const data=JSON.parse(body),subscription=data.subscription;
  const chat=subscription?.type===CHAT_TYPE,type=request.headers.get('twitch-eventsub-message-type');
  if(![REDEMPTION_TYPE,CHAT_TYPE].includes(subscription?.type)||subscription?.version!=='1')return new Response(null,{status:403});
  const event=data.event;
  const stop=chat&&isStopCommand(event||{});
  const giveawayEntry=chat&&event?.message?.text?.trim().toLowerCase()==='trash'&&
    (!event.source_broadcaster_user_id||event.source_broadcaster_user_id===event.broadcaster_user_id);
  // Unrelated chat never touches the database.
  if(chat&&type==='notification'&&((!stop&&!giveawayEntry)||Date.now()-Date.parse(request.headers.get('twitch-eventsub-message-timestamp')||'')>30000))return new Response(null,{status:204});
  const config=await pointsConfig();
  if(subscription?.condition?.broadcaster_user_id!==config.broadcaster_id||(chat&&subscription.condition.user_id!==config.broadcaster_id))return new Response(null,{status:403});
  const idField=chat?'chat_subscription_id':'subscription_id',statusField=chat?'chat_subscription_status':'subscription_status';
  if(type==='webhook_callback_verification'){
   if(typeof data.challenge!=='string'||data.challenge.length>1000)return new Response(null,{status:400});
   await savePoints({[idField]:subscription.id,[statusField]:'enabled'});
   return new Response(data.challenge,{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
  }
  if(subscription.id!==config[idField])return new Response(null,{status:403});
  if(type==='revocation'){await savePoints({[statusField]:subscription.status});await disablePoints();return new Response(null,{status:204});}
  if(type!=='notification')return new Response(null,{status:400});
  if(event?.broadcaster_user_id!==config.broadcaster_id)return new Response(null,{status:403});
  if(chat){
   if(typeof event.message_id!=='string'||!event.message_id||event.message_id.length>200)return new Response(null,{status:400});
   if(giveawayEntry){
    const login=event.chatter_user_login;
    if(typeof login!=='string'||!(/^[a-z0-9_]{1,25}$/i).test(login)||
      typeof event.chatter_user_id!=='string'||!(/^\d+$/).test(event.chatter_user_id))return new Response(null,{status:400});
    const {enterChatGiveaway}=await import('@/lib/chat-giveaway-entry');
    const result=await enterChatGiveaway({username:login,display_name:event.chatter_user_name||login,twitch_id:event.chatter_user_id,platform:'twitch'});
    return new Response(null,{status:result.status>=500?503:204});
   }
   await stopFromChat(event.message_id,String(event.chatter_user_login||'moderator'),event.broadcaster_user_id);
   return new Response(null,{status:204});
  }
  if(typeof event?.id!=='string'||event.id.length>200||typeof event.reward?.id!=='string')return new Response(null,{status:400});
  if(event.reward.id!==config.reward_id)return new Response(null,{status:204});
  await enqueueRedemption(event.id,String(event.user_login||event.user_name||'viewer'),event.broadcaster_user_id,event.reward.id);
  return new Response(null,{status:204});
 }catch{return new Response(null,{status:503});}
}
