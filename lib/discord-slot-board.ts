import 'server-only';
import {after} from 'next/server';
import {createHash,randomUUID} from 'node:crypto';
import {siteDb} from './site-db';
import {discordWebhook,slotBoard,type BoardCall,type BoardEntry,type BoardPayload} from './discord-slot-board-format';
type Saved={id:string;hash:string};
type State={webhook_url:string;messages:Record<string,Saved[]>};
class DiscordFailure extends Error {constructor(public retry=15,public missing=false){super('Discord update failed.');}}
let nextLocalCheck=0,nextReconcile=0;
export function scheduleSlotBoard(reconcile=false){
 if(process.env.NODE_ENV!=='production'||process.env.NEXT_PUBLIC_LOCAL_REVIEW==='1'||Date.now()<nextLocalCheck)return;
 if(reconcile&&Date.now()<nextReconcile)return;
 nextLocalCheck=Date.now()+5000;nextReconcile=Date.now()+30000;
 after(async()=>{try{await new Promise(resolve=>setTimeout(resolve,5000));await syncSlotBoard();}catch{console.error('Discord slot board update could not complete.');}});
}
async function discord(url:string,method:string,body?:BoardPayload){
 const r=await fetch(url,{method,redirect:'error',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
 if(r.status===429){const d=await r.json().catch(()=>({}));throw new DiscordFailure(Math.min(3600,Math.max(5,Number(d.retry_after)||15)));}
 if(!r.ok)throw new DiscordFailure(r.status===401||r.status===403?300:15,r.status===404);
 return r.status===204?null:await r.json();
}
async function allRows<T>(table:string,columns:string,hunt?:string):Promise<T[]>{
 const rows:T[]=[];for(let offset=0;;offset+=1000){let q=siteDb().from(table).select(columns).order('created_at',{ascending:true}).order('id').range(offset,offset+999);if(hunt)q=q.eq('hunt_id',hunt).is('deleted_at',null);const r=await q;if(r.error)throw Error('Could not read slot board data.');rows.push(...((r.data||[]) as unknown as T[]));if((r.data||[]).length<1000)return rows;}
}
export async function syncSlotBoard(){
 const db=siteDb(),lease=randomUUID();
 const claim=await db.rpc('discord_slot_board_claim',{p_lease:lease});if(claim.error){if(['42P01','PGRST202','PGRST205'].includes(claim.error.code))return;throw Error('Discord board storage unavailable.');}
 const state=claim.data?.[0] as State|undefined;if(!state)return;
 const messages=structuredClone(state.messages||{});let delay=5,lastError='',complete=false;
 const save=async()=>{const r=await db.from('discord_slot_board').update({messages}).eq('id',true).eq('lease_id',lease);if(r.error)throw Error('Could not save Discord message references.');};
 try{
  const url=discordWebhook(state.webhook_url),started=Date.now();
  const setting=await db.from('site_tracker_settings').select('active_hunt_id').eq('id',true).maybeSingle();if(setting.error)throw Error('Could not read active hunt.');
  const huntId=setting.data?.active_hunt_id;
  const [calls,entries,hunt]=await Promise.all([allRows<BoardCall>('slot_calls','id,username,slot_name,picked_at,created_at'),huntId?allRows<BoardEntry>('site_tracker_entries','id,username,slot_name,status,bonus_tier,call_id,identifier,created_at',huntId):Promise.resolve([]),huntId?db.from('site_tracker_hunts').select('title').eq('hunt_id',huntId).is('deleted_at',null).maybeSingle():Promise.resolve({data:null,error:null})]);
  if(hunt.error)throw Error('Could not read hunt title.');
  const visible=entries.filter(e=>e.status==='collected');
  const names=new Set(visible.map(e=>String(e.slot_name).trim().toLowerCase()));
  const payloads=slotBoard(hunt.data?.title||'',calls.filter(c=>c.picked_at||!names.has(String(c.slot_name).trim().toLowerCase())),entries);
  for(const [group,pages] of Object.entries(payloads)){
   const saved=messages[group]||=[];
   for(let i=0;i<pages.length;i++){
    if(Date.now()-started>40000)throw new DiscordFailure(5);
    const hash=createHash('sha256').update(JSON.stringify(pages[i])).digest('hex');if(saved[i]?.hash===hash)continue;
    if(saved[i]){try{await discord(url+'/messages/'+saved[i].id,'PATCH',pages[i]);saved[i].hash=hash;await save();continue;}catch(e){if(!(e instanceof DiscordFailure)||!e.missing)throw e;}}
    const created=await discord(url+'?wait=true','POST',pages[i]);if(!/^\d+$/.test(created?.id||''))throw Error('Discord did not return a message ID.');saved[i]={id:created.id,hash};await save();
   }
   while(saved.length>pages.length){const old=saved.at(-1)!;try{await discord(url+'/messages/'+old.id,'DELETE');}catch(e){if(!(e instanceof DiscordFailure)||!e.missing)throw e;}saved.pop();await save();}
  }
  complete=true;
 }catch(error){delay=error instanceof DiscordFailure?error.retry:30;lastError='Discord update delayed. Check webhook permissions or refresh to retry.';}
 finally{const r=await db.from('discord_slot_board').update({messages,lease_id:null,lease_until:null,next_attempt:new Date(Date.now()+delay*1000).toISOString(),last_error:lastError,...(complete?{last_synced_at:new Date().toISOString()}: {})}).eq('id',true).eq('lease_id',lease);if(r.error)throw Error('Could not release Discord update.');}
}
export async function slotBoardStatus(){const r=await siteDb().from('discord_slot_board').select('enabled,last_synced_at,last_error,webhook_url').eq('id',true).single();if(r.error)throw Error('Discord board database setup is required.');return {enabled:r.data.enabled,configured:Boolean(r.data.webhook_url),lastSynced:r.data.last_synced_at,error:r.data.last_error,local:process.env.NODE_ENV!=='production'};}
