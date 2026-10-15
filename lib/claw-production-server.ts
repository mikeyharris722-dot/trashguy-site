import 'server-only';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {localCommunity} from './community-store';
import {siteDb} from './site-db';
import {CLAW_PRODUCTION_MS,productionIsActive,validProductionRequest,type ProductionEvent} from './claw-production';
type State={event:ProductionEvent|null;actor?:string};
const file=path.join(process.cwd(),'.local','claw-production.json'),lock=Symbol.for('trashguy.claw.production'),holder=globalThis as typeof globalThis&{[lock]?:Promise<unknown>};
async function localState():Promise<State>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;return {event:null};}}
export async function productionState():Promise<ProductionEvent|null>{if(localCommunity())return (await localState()).event;const {data,error}=await siteDb().from('claw_production_state').select('event_id,started_at').eq('id',true).maybeSingle();if(error){if(error.code==='42P01'||error.code==='PGRST205')return null;throw Error('Production overlay is temporarily unavailable.');}return data?.event_id&&data.started_at?{id:data.event_id,startedAt:data.started_at,durationMs:CLAW_PRODUCTION_MS}:null;}
export async function productionCommand(actor:string,action:string,requestId?:unknown):Promise<ProductionEvent|null>{if(!['play','stop'].includes(action))throw Error('Choose play or stop.');const request=action==='play'?validProductionRequest(requestId):null;
if(!localCommunity()){const {data,error}=await siteDb().rpc('claw_production_command',{p_actor:actor,p_action:action,p_request:request});if(error)throw Error(error.code==='PGRST202'?'Production overlay database setup is not ready.':error.message);return data as ProductionEvent|null;}
const run=async()=>{const state=await localState();if(action==='play'&&state.event?.id===request){if(state.actor!==actor)throw Error('Production request belongs to another admin.');return state.event;}if(action==='play'&&productionIsActive(state.event))throw Error('Production is already playing.');const event=action==='play'?{id:request!,startedAt:new Date().toISOString(),durationMs:CLAW_PRODUCTION_MS}:null;await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify({event,actor}));await fs.rename(tmp,file);return event;};const job=(holder[lock]||Promise.resolve()).catch(()=>{}).then(run);holder[lock]=job;return job;}
