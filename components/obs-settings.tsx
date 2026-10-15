"use client";
import {useState,useSyncExternalStore} from 'react';
const subscribe=()=>()=>{};
const getOrigin=()=>window.location.origin;
export default function ObsSettings(){const origin=useSyncExternalStore(subscribe,getOrigin,()=>''),url=origin+'/overlay';return <details className="lb-admin-totals"><summary>OBS overlay</summary><p>Browser Source: width 435, height 285. Follows the active hunt. Collection scrolls; opening follows the bonus order.</p><label>Overlay URL<input readOnly aria-label="OBS overlay URL" value={url}/></label><a href={url} target="_blank" rel="noopener noreferrer">Preview overlay ↗</a></details>;}

export function ClawObsSettings() {
  const origin=useSyncExternalStore(subscribe,getOrigin,()=>''),url=origin+'/claw-production';
  const [message,setMessage]=useState('');
  return <details className="lb-admin-totals"><summary>Trash Claw production overlay</summary>
    <p>Browser Source: width 1920, height 1080. Add above your gameplay. Transparent until the Giveaways PRODUCTION button is pressed; the nine-second intro fades in, plays once, fades out and clears.</p>
    <label>Production overlay URL<input readOnly aria-label="Production overlay URL" value={url}/></label>
    <div className="production-settings-links"><button type="button" onClick={()=>{void navigator.clipboard.writeText(url).then(()=>setMessage('Overlay URL copied.'),()=>setMessage('Select the URL above and copy it.'));}}>Copy URL</button><a href={url+'?preview=1'} target="_blank" rel="noopener noreferrer">Test intro ↗</a></div>
    <p>Leave “Shutdown source when not visible” and “Refresh browser when scene becomes active” off. Enable “Control audio via OBS” to mix the music separately. A normal browser may need sound permission.</p>
    {message&&<p role="status">{message}</p>}
  </details>;
}
