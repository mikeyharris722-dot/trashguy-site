import {serverPrizeSettings} from '@/lib/server-prize-settings';
import {requireTrackerAdmin,apiError} from '@/lib/site-db';
export async function GET(request:Request){try{const settings=await serverPrizeSettings();let admin=false;try{await requireTrackerAdmin(request);admin=true;}catch{}return Response.json({enabled:settings.trashBossesEnabled===true,weeklyEnabled:settings.weeklyWager?.enabled===true,admin},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return apiError(e);}}
