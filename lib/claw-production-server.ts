import 'server-only';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {localCommunity} from './community-store';
import {siteDb} from './site-db';
import {CLAW_PRODUCTION_MS,HALLOWEEN_MS,HALLOWEEN_READY,productionIsActive,validProductionRequest,type ProductionEvent} from './claw-production';
import {SCOTLAND_MS} from './twitch-points-security';

type Queued={id:string;queuedAt:string;volume:number};
type State={event:ProductionEvent|null;actor?:string;queue?:Queued[]};
const file=path.join(process.cwd(),'.local','claw-production.json'),lock=Symbol.for('trashguy.claw.production'),holder=globalThis as typeof globalThis&{[lock]?:Promise<unknown>};
async function localState():Promise<State>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;return {event:null,queue:[]};}}
async function localChange<T>(change:(state:State)=>T):Promise<T>{const run=async()=>{const state=await localState(),result=change(state);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(state));await fs.rename(file+'.tmp',file);return result;};const job=(holder[lock]||Promise.resolve()).catch(()=>{}).then(run);holder[lock]=job;return job;}
export async function queueLocalScotland(volume:number){if(!localCommunity())throw Error('Local test is unavailable.');return localChange(state=>{state.queue??=[];if(state.queue.length>=20)throw Error('Queue full.');state.queue.push({id:randomUUID(),queuedAt:new Date().toISOString(),volume});});}
export async function productionState(advance=false):Promise<ProductionEvent|null>{
 if(localCommunity())return localChange(state=>{if(advance&&!productionIsActive(state.event)&&!(state.event&&Date.parse(state.event.startedAt)>Date.now())){state.queue=(state.queue||[]).filter(item=>Date.parse(item.queuedAt)>Date.now()-900000);const next=state.queue.shift();if(next)state.event={id:next.id,startedAt:new Date(Date.now()+1000).toISOString(),durationMs:SCOTLAND_MS,clip:'scotland',volume:next.volume};}return state.event;});
 const {data,error}=await siteDb().from('claw_production_state').select('event_id,started_at,duration_ms,clip,volume,queue').eq('id',true).maybeSingle();
 if(error){if(error.code==='42P01'||error.code==='PGRST205')return null;throw Error('Production overlay is temporarily unavailable.');}
 const event:ProductionEvent|null=data?.event_id&&data.started_at?{id:data.event_id,startedAt:data.started_at,durationMs:data.duration_ms||CLAW_PRODUCTION_MS,clip:data.clip,volume:Number(data.volume)}:null;
 if(advance&&data?.queue?.length&&(!event||Date.parse(event.startedAt)+event.durationMs<=Date.now())){const next=await siteDb().rpc('twitch_points_next');if(next.error)throw Error('Production queue is temporarily unavailable.');if(next.data)return next.data as ProductionEvent;}
 return event;
}
export async function productionCommand(actor:string,action:string,requestId?:unknown,clip:'claw'|'halloween'='claw'):Promise<ProductionEvent|null>{if(!['play','stop'].includes(action))throw Error('Choose play or stop.');const request=action==='play'?validProductionRequest(requestId):null;
 if(action==='play'&&clip==='halloween'&&!HALLOWEEN_READY)throw Error('The Halloween video is still being prepared.');
 if(!localCommunity()){const {data,error}=await siteDb().rpc(action==='play'&&clip==='halloween'?'claw_production_halloween':'claw_production_command',action==='play'&&clip==='halloween'?{p_actor:actor,p_request:request}:{p_actor:actor,p_action:action,p_request:request});if(error)throw Error(error.code==='PGRST202'?'Production overlay database setup is not ready.':error.message);return data as ProductionEvent|null;}
 return localChange(state=>{if(action==='play'&&state.event?.id===request){if(state.actor!==actor)throw Error('Production request belongs to another admin.');if((state.event.clip||'claw')!==clip)throw Error('Production request belongs to another clip.');return state.event;}
 if(action==='play'&&(productionIsActive(state.event)||(state.event&&Date.parse(state.event.startedAt)>Date.now())||(state.queue||[]).length))throw Error('Production is playing or a channel-point clip is queued. Stop playback to clear the queue.');
 const event=action==='play'?{id:request!,startedAt:new Date().toISOString(),durationMs:clip==='halloween'?HALLOWEEN_MS:CLAW_PRODUCTION_MS,clip,volume:clip==='halloween'?0.85:0.7}:null;state.event=event;state.actor=actor;if(action==='stop')state.queue=[];return event;});
}
