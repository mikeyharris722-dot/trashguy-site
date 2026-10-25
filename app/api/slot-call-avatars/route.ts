import {slotCallAvatars} from '@/lib/slot-call-avatars';
export async function GET(request:Request){
 const query=new URL(request.url).searchParams.get('users')||'';
 if(query.length>3000)return Response.json({avatars:{}},{status:400});
 return Response.json({avatars:await slotCallAvatars(query.split(','))},{headers:{'Cache-Control':'public, max-age=60'}});
}
