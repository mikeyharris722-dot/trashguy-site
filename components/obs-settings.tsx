"use client";
import {useState,useSyncExternalStore} from 'react';
import {siteFetch} from '@/lib/site-fetch';
import {DEFAULT_OVERLAY_ACCENT,overlayAccent,overlayTheme} from '@/lib/overlay-theme';
import type {CSSProperties} from 'react';
const subscribe=()=>()=>{};
const getOrigin=()=>window.location.origin;
export default function ObsSettings(){
  const origin=useSyncExternalStore(subscribe,getOrigin,()=>''),url=origin+'/overlay';
  const [colour,setColour]=useState(DEFAULT_OVERLAY_ACCENT),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  let valid=DEFAULT_OVERLAY_ACCENT,error='';
  try{valid=overlayAccent(colour);}catch(e){error=(e as Error).message;}
  async function load(){
    if(loaded||busy)return;setBusy(true);
    try{const r=await siteFetch('/api/admin/overlay-settings');const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load overlay colour.');setColour(d.accentColor);setLoaded(true);setMessage('');}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  async function save(){
    if(busy||error||!loaded)return;setBusy(true);setMessage('');
    try{const r=await siteFetch('/api/admin/overlay-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accentColor:valid,requestId:crypto.randomUUID()})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not save overlay colour.');setColour(d.accentColor);setMessage('Saved. OBS updates automatically within a few seconds.');}
    catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  const theme=overlayTheme(valid);
  const colourButton='rounded-lg border border-purple-300/30 bg-purple-500/15 px-3 py-2 text-sm font-bold disabled:opacity-40';
  return <details className="lb-admin-totals" onToggle={e=>{if(e.currentTarget.open)void load();}}><summary>OBS overlay</summary>
    <p>Browser Source: width 435, height 285. Follows the active regular hunt. Collection scrolls; opening follows the bonus order.</p>
    <fieldset disabled={busy||!loaded}><legend>Tracker accent colour</legend>
      <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end'}}>
        <label>Choose colour<input type="color" aria-label="OBS tracker colour picker" value={valid} onChange={e=>{setColour(e.target.value.toUpperCase());setMessage('');}} style={{width:64,height:42,padding:3}} /></label>
        <label style={{flex:'1 1 150px'}}>Hex colour<input aria-label="OBS tracker hex colour" value={colour} maxLength={7} spellCheck={false} aria-invalid={!!error} aria-describedby={error?'overlay-colour-error':undefined} onChange={e=>{setColour(e.target.value);setMessage('');}} placeholder="#075D5E" /></label>
      </div>
      {error&&<p id="overlay-colour-error" role="alert">{error}</p>}
      <div aria-label="Overlay colour preview" style={{...theme,background:'var(--hunt-accent, #075d5e)',color:'var(--hunt-header-text, #FFFFFF)',padding:'8px 12px',borderRadius:6,margin:'10px 0',fontWeight:700} as CSSProperties}>Bonus Hunt · COLLECTING</div>
      <p>Changes borders, header and highlights on the regular and community OBS trackers. Your existing OBS URLs stay the same.</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}><button className={colourButton} type="button" disabled={!!error} onClick={()=>void save()}>Save overlay colour</button><button className={colourButton} type="button" onClick={()=>{setColour(DEFAULT_OVERLAY_ACCENT);setMessage('Default selected. Save overlay colour to apply.');}}>Reset to default</button></div>
    </fieldset>
    {!loaded&&!busy&&<button type="button" onClick={()=>void load()}>Load overlay colour</button>}
    {busy&&<p role="status">Loading / saving…</p>}{message&&<p role="status">{message}</p>}
    <label>Overlay URL<input readOnly aria-label="OBS overlay URL" value={url}/></label><a href={url} target="_blank" rel="noopener noreferrer">Preview regular overlay ↗</a><label>Community overlay URL<input readOnly aria-label="Community OBS overlay URL" value={url+'?community=1'}/></label><a href={url+'?community=1'} target="_blank" rel="noopener noreferrer">Preview community overlay ↗</a><p>Community Hunt uses its own active hunt. The two overlays do not switch each other.</p>
  </details>;
}

export function ClawObsSettings() {
  const origin=useSyncExternalStore(subscribe,getOrigin,()=>''),url=origin+'/claw-production';
  const [message,setMessage]=useState('');
  return <details className="lb-admin-totals"><summary>Trash Claw production overlay</summary>
    <p>Browser Source: width 1920, height 1080. Add above your gameplay. Transparent between videos. Plays the nine-second Giveaways intro or an enabled channel-point video, fades and clears. Channel-point clips use a shared queue so they do not overlap.</p>
    <label>Production overlay URL<input readOnly aria-label="Production overlay URL" value={url}/></label>
    <div className="production-settings-links"><button type="button" onClick={()=>{void navigator.clipboard.writeText(url).then(()=>setMessage('Overlay URL copied.'),()=>setMessage('Select the URL above and copy it.'));}}>Copy URL</button><a href={url+'?preview=1'} target="_blank" rel="noopener noreferrer">Test intro ↗</a></div>
    <p>Leave “Shutdown source when not visible” and “Refresh browser when scene becomes active” off. Enable “Control audio via OBS” to mix the music separately. A normal browser may need sound permission.</p>
    {message&&<p role="status">{message}</p>}
  </details>;
}
