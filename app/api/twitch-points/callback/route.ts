import {NextRequest,NextResponse} from 'next/server';
import {connectBroadcaster,validInvite} from '@/lib/twitch-points-server';
import {unseal} from '@/lib/twitch-points-security';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 let result='error';
 try{
  const cookie=request.cookies.get('trashguy_points_oauth')?.value||'';
  const saved=unseal<{state:string;invite:string;expires:number}>(cookie);
  if(saved.expires<Date.now()||saved.state!==request.nextUrl.searchParams.get('state'))throw Error('Invalid connection request.');
  const code=request.nextUrl.searchParams.get('code');if(!code)throw Error('Authorisation was cancelled.');
  if(!await validInvite(saved.invite,true))throw Error('Connection link expired.');
  await connectBroadcaster(code);result='connected';
 }catch{/* Never return tokens, codes or provider errors to the browser URL. */}
 const response=NextResponse.redirect(new URL('/twitch-connect?result='+result,request.url));
 response.cookies.delete({name:'trashguy_points_oauth',path:'/api/twitch-points'});
 response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
