import {productionState,productionCommand} from '@/lib/claw-production-server';
import {CLAW_PRODUCTION_MOVIE,CLAW_PRODUCTION_MS} from '@/lib/claw-production';
import {requireTrackerAdmin,apiError} from '@/lib/site-db';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){try{return Response.json({event:await productionState(),serverNow:Date.now(),movie:CLAW_PRODUCTION_MOVIE,durationMs:CLAW_PRODUCTION_MS},{headers});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{const actor=await requireTrackerAdmin(request);const body=await request.json();const event=await productionCommand(actor,String(body.action||'play'),body.requestId);return Response.json({event,serverNow:Date.now()},{headers});}catch(error){return apiError(error);}}
