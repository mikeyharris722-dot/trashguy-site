"use client";
import {useState} from 'react';
import ClawProductionControls from './claw-production-controls';
export default function SeafoamVideoSettings(){
 const [open,setOpen]=useState(false);
 return <details className="settings-section" onToggle={e=>setOpen(e.currentTarget.open)}><summary><span><strong>Sea-Foam Spin video</strong><small>Play through the existing production overlay</small></span><span className="settings-chevron" aria-hidden="true">⌄</span></summary><div className="settings-section-body points-settings">
 <p>Sea-Foam Spin plays fullscreen through the existing 1920 × 1080 claw production browser source, then fades back to transparent. No extra OBS source is needed.</p>
 {open&&<ClawProductionControls clip="seafoam"/>}
 <p>Clips cannot overlap. If a production or channel-point video is playing or queued, wait for it to finish.</p>
 </div></details>;
}
