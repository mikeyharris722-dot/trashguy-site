import { apiError, siteDb } from '@/lib/site-db';
import { trackerHunts } from '@/lib/site-tracker';
import { reviewNativeSelection } from '@/lib/review-selection';
export async function GET(request:Request) {
  try {
    const url=new URL(request.url);
    const settingsRead=siteDb().from('site_tracker_settings').select('active_hunt_id,opening_queue').eq('id',true).maybeSingle();
    if(url.searchParams.get('selection')==='1') {
      const settings=await settingsRead;if(settings.error)throw Error(settings.error.message);
      return Response.json({activeHuntId:(await reviewNativeSelection())||settings.data?.active_hunt_id||''});
    }
    const [hunts,settings]=await Promise.all([trackerHunts(url.searchParams.get('huntId')||undefined),settingsRead]);
    if(settings.error)throw Error(settings.error.message);
    return Response.json({
      hunts:hunts.map(h=>({...h,openingQueue:h.id===settings.data?.active_hunt_id?settings.data?.opening_queue||[]:[]})),
      activeHuntId:(await reviewNativeSelection())||settings.data?.active_hunt_id||'',
    });
  } catch(error){return apiError(error);}
}
