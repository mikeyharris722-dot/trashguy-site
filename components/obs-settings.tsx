"use client";
import {useSyncExternalStore} from 'react';
const subscribe=()=>()=>{};
const getOrigin=()=>window.location.origin;
export default function ObsSettings(){const origin=useSyncExternalStore(subscribe,getOrigin,()=>''),url=origin+'/overlay';return <details className="lb-admin-totals"><summary>OBS overlay</summary><p>Browser Source: width 435, height 285. Follows the active hunt. Collection scrolls; opening follows the bonus order.</p><label>Overlay URL<input readOnly aria-label="OBS overlay URL" value={url}/></label><a href={url} target="_blank" rel="noopener noreferrer">Preview overlay ↗</a></details>;}
