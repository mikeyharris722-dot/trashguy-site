import {siteDb,apiError} from '@/lib/site-db';
export async function GET(){try{
 const users:string[]=[];
 for(let start=0;;start+=1000){const r=await siteDb().from('roulo_links').select('twitch_username').eq('role','vip').order('id').range(start,start+999);if(r.error)throw r.error;for(const row of r.data||[])if(row.twitch_username)users.push(row.twitch_username);if((r.data||[]).length<1000)break;}
 // Only the site name and its authorised VIP badge. No account links or wager details.
 return Response.json({users:[...new Set(users)]},{headers:{'Cache-Control':'public, max-age=30, s-maxage=30'}});
}catch(e){return apiError(e)}}
