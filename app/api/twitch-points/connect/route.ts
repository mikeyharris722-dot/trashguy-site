import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {appConfig,validInvite} from '@/lib/twitch-points-server';
import {POINTS_SCOPES,seal} from '@/lib/twitch-points-security';
export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const invite=new URL(request.url).searchParams.get('invite')||'';
  if(!await validInvite(invite))return new Response('This connection link has expired or was used. Ask an admin for a new link.',{status:400});
  const state=randomBytes(32).toString('base64url'),config=appConfig();
  const url=new URL('https://id.twitch.tv/oauth2/authorize');
  url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.callback,response_type:'code',scope:POINTS_SCOPES.join(' '),state,force_verify:'true'}).toString();
  const response=NextResponse.redirect(url);
  response.cookies.set('trashguy_points_oauth',seal({state,invite,expires:Date.now()+600000}),{httpOnly:true,secure:config.origin.startsWith('https:'),sameSite:'lax',path:'/api/twitch-points',maxAge:600});
  response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
 }catch{return new Response('The Twitch connection is unavailable. Ask an admin to check its setup.',{status:503});}
}
