import {viewerKey,type StatsHunt} from './community-stats';
export function isBossCall(callId: unknown): boolean {
 const id=String(callId||'');
 return !!id && (!id.startsWith('manual:') || /^manual:viewer:[0-9a-f-]{36}$/i.test(id));
}
export type BossTarget={target:number;reward:number};
export const defaultBossTargets:BossTarget[]=[{target:1000,reward:10},{target:2000,reward:20},{target:3000,reward:30}];
export type BossPlayer={key:string;name:string;total:number;calls:number;reached:number;progress:number};
export function trashBossProgress(hunts:StatsHunt[],start:string,end:string,targets:BossTarget[]):BossPlayer[]{
 const from=Date.parse(start+'T00:00:00Z'),to=Date.parse(end+'T00:00:00Z'),seen=new Set<string>(),players=new Map<string,{name:string;cents:number;calls:number}>();
 for(const hunt of hunts.filter(h=>h.source!=="community"&&h.casino!=="Rainbet"))for(const entry of hunt.entries||[]){
  const id=hunt.id+':'+entry.id,key=viewerKey(entry.username||'');
  const date=Date.parse((entry as typeof entry&{payout_recorded_at?:string}).payout_recorded_at||entry.updated_at||'');
  if(seen.has(id)||!key||!isBossCall((entry as typeof entry&{call_id?:string}).call_id)||entry.status!=='collected'||entry.payout===null||entry.payout===''||!Number.isFinite(date)||date<from||date>=to)continue;
  const amount=Number(entry.payout);if(!Number.isFinite(amount)||amount<0)continue;seen.add(id);
  const p=players.get(key)||{name:entry.username,cents:0,calls:0};p.cents+=Math.round(amount*100);p.calls++;players.set(key,p);
 }
 return [...players].map(([key,p])=>({key,name:p.name,total:p.cents/100,calls:p.calls,reached:targets.filter(t=>p.cents>=Math.round(t.target*100)).length,progress:Math.min(100,p.cents/Math.round(targets[targets.length-1].target*100)*100)})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
}
