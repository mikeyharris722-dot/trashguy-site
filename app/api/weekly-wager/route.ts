import {weeklyEndExclusive} from "@/lib/weekly-wager";
import {providerRows} from "@/lib/leaderboard-provider";
import {affiliateStandings} from "@/lib/leaderboard-data";
import {weeklySettings,weeklyClaims,weeklyWeighted} from "@/lib/weekly-wager-server";
import {requireTrackerAdmin,apiError} from "@/lib/site-db";
import {requireViewer} from "@/lib/viewer-auth";
const headers = {"Cache-Control":"private, no-store"};
export async function GET(request:Request) {
  try {
    const settings=await weeklySettings();
    if (!settings.enabled) {
      let admin=false;
      try { await requireTrackerAdmin(request); admin=true; } catch {}
      if(!admin) return Response.json({error:"Not available"},{status:404,headers});
    }
    const signedIn=!!request.headers.get("authorization")?.replace(/^Bearer\s*/i,"").trim();
    const end=weeklyEndExclusive(settings.end);
    const [rows,who]=await Promise.all([
      Date.now()<Date.parse(settings.start+"T00:00:00Z") ? [] : providerRows(settings.start,end),
      signedIn ? requireViewer(request,"twitch") : null,
    ]);
    const players=affiliateStandings(rows).players;
    if(!who) return Response.json({settings,players,linked:false,weighted:0,account:"",history:[],signedIn:false},{headers});
    const [progress,history]=await Promise.all([weeklyWeighted(who.name,settings.start,end,rows),weeklyClaims(who.name)]);
    return Response.json({settings,players,...progress,history,signedIn:true},{headers});
  } catch(error) {
    if(error instanceof Error&&error.message==="PROVIDER_RATE_LIMIT")return Response.json({error:"Roulo is limiting requests. Progress will retry within a minute."},{status:429,headers});
    return apiError(error);
  }
}
