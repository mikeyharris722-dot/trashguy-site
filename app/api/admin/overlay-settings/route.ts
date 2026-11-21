import {requireTrackerAdmin,apiError} from '@/lib/site-db';
import {serverPrizeSettings} from '@/lib/server-prize-settings';
import {communityJson} from '@/lib/community-request';
import {communityCommand} from '@/lib/community-local';
import {overlayAccent,DEFAULT_OVERLAY_ACCENT} from '@/lib/overlay-theme';
export async function GET(request:Request) {
  try {
    await requireTrackerAdmin(request);
    return Response.json({accentColor:(await serverPrizeSettings()).overlayAccent||DEFAULT_OVERLAY_ACCENT},{headers:{'Cache-Control':'private, no-store'}});
  } catch(e){return apiError(e);}
}
export async function POST(request:Request) {
  try {
    const id=await requireTrackerAdmin(request),body=await communityJson(request,2048);
    const accentColor=overlayAccent(body.accentColor);
    await communityCommand({id,name:'Admin'},true,{action:'overlayAppearance',accentColor,requestId:body.requestId});
    return Response.json({accentColor},{headers:{'Cache-Control':'private, no-store'}});
  } catch(e){return apiError(e);}
}
