export type ClawRevealKind='loss'|'cash'|'boost'|'spin'|'choice'|'prize';
export type ClawSoundKey='cash'|'double'|'loss'|'trash-call'|'mod-call'|'slot-picker'|'boost'|'tables'|'choice'|'feature-spins'|'prize';
const normalise=(name:string)=>name.trim().toUpperCase().replace(/[–—]/g,'-').replace(/\s+/g,' ').replace(/\s*\/\s*/g,'/');
/** Match the actual prize name, rather than reusing a generic musical win cue. */
export function clawSoundForPrize(name:string):ClawSoundKey{const key=normalise(name);if(key.includes('CASH'))return 'cash';if(key.includes('MOD')&&key.includes('CALL'))return 'mod-call';if(key.includes('CALL'))return 'trash-call';if(key.includes('DOUBLE')||/^2\s*[X×]$/.test(key))return 'double';if(/^-\s*\d|\b(?:LOSE|LOSS|REDUCE)\b/.test(key))return 'loss';if(key.includes('+'))return 'boost';if(/BEST[ -]+OF[ -]+TWO/.test(key))return 'choice';if(key.includes('TABLE')||key.includes('KENO'))return 'tables';if(key.includes('FEATURE')||key.includes('SPIN'))return 'feature-spins';if(key.includes('SLOT')||key.includes('PICKER'))return 'slot-picker';return 'prize';}
export function clawRevealKind(prize:string):ClawRevealKind{const sound=clawSoundForPrize(prize);return sound==='cash'||sound==='loss'||sound==='choice'?sound:sound==='double'||sound==='boost'?'boost':sound==='slot-picker'||sound==='feature-spins'?'spin':'prize';}
const recordings=new WeakMap<AudioContext,Map<ClawSoundKey,AudioBuffer>>();
const pending=new WeakMap<AudioContext,Map<ClawSoundKey,Promise<boolean>>>();
export async function prepareClawReveal(context:AudioContext,kind:ClawSoundKey):Promise<boolean>{
 if(recordings.get(context)?.has(kind))return true;
 let loads=pending.get(context);if(!loads){loads=new Map();pending.set(context,loads);}
 const existing=loads.get(kind);if(existing)return existing;
 const job=(async()=>{try{const response=await fetch(`/claw-reveal/v3/${kind}.mp3`,{cache:'force-cache',signal:AbortSignal.timeout(5000)});if(!response.ok)return false;const decoded=await context.decodeAudioData(await response.arrayBuffer());let sounds=recordings.get(context);if(!sounds){sounds=new Map();recordings.set(context,sounds);}sounds.set(kind,decoded);return true;}catch{return false;}finally{loads.delete(kind);}})();loads.set(kind,job);return job;
}
/** Recorded foley only. Never substitute the rejected electronic jingles. */
export function playClawReveal(context:AudioContext,kind:ClawSoundKey,volume:number){
 const recording=recordings.get(context)?.get(kind);
 if(!recording)return ()=>{};
 const source=context.createBufferSource(),gain=context.createGain();source.buffer=recording;gain.gain.value=(Number.isFinite(volume)?Math.min(1,Math.max(0,volume)):0)*.8;source.connect(gain);gain.connect(context.destination);
 let disposed=false;const dispose=()=>{if(!disposed){disposed=true;source.disconnect();gain.disconnect();}};source.onended=dispose;source.start();return()=>{try{source.stop();}catch{}dispose();};
}
