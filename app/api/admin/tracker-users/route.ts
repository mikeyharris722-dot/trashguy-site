import {apiError,requireTrackerAdmin,siteDb} from "@/lib/site-db";
export async function GET(request:Request) {
 try {
  await requireTrackerAdmin(request);
  const query=(new URL(request.url).searchParams.get("q")||"").trim();
  if(!/^[a-zA-Z0-9_]{2,50}$/.test(query))return Response.json({users:[]},{headers:{"Cache-Control":"private, no-store"}});
  const {data,error}=await siteDb().from("profiles").select("id,username").not("twitch_user_id","is",null).neq("twitch_user_id","").ilike("username","%"+query.replaceAll("_","\\_")+"%").order("username").limit(20);
  if(error)throw Error("Could not search site users. Try again.");
  return Response.json({users:data||[]},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiError(error);}
}
