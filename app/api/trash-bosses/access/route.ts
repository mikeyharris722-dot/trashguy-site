import {communityState} from '@/lib/community-local';
import {resolvedPrizeSettings} from '@/lib/prize-settings';
import {requireTrackerAdmin,apiError} from '@/lib/site-db';
export async function GET(request:Request){try{const settings=resolvedPrizeSettings((await communityState()).prizeSettings);let admin=false;try{await requireTrackerAdmin(request);admin=true;}catch{}return Response.json({enabled:settings.trashBossesEnabled===true,admin},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return apiError(e);}}
