"use client";
import {useState} from 'react';
import {siteFetch} from '@/lib/site-fetch';
type Status={local:boolean;configured:boolean;callback:string;expectedLogin:string;enabled:boolean;rewardId:string;volume:number;connected:boolean;login:string|null;subscriptionStatus:string;receipts:{redemption_id:string;viewer:string;status:string;received_at:string}[]};
type Reward={id:string;title:string;cost:number;enabled:boolean};
export default function TwitchPointsSettings(){
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[link,setLink]=useState(''),[rewardList,setRewards]=useState<Reward[]>([]),[rewardId,setRewardId]=useState(''),[enabled,setEnabled]=useState(false),[volume,setVolume]=useState(1);
 async function refresh(){const response=await siteFetch('/api/admin/twitch-points',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'Settings unavailable.');setStatus(data);setEnabled(data.enabled);setRewardId(data.rewardId);setVolume(data.volume);}
 async function run(action:string){if(busy)return;setBusy(true);setMessage('');try{
  if(action==='refresh'){if(status?.connected&&!status.local){const response=await siteFetch('/api/admin/twitch-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'check'})}),data=await response.json();if(!response.ok)throw Error(data.error||'Connection check failed.');}await refresh();return;}
  const response=await siteFetch('/api/admin/twitch-points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,rewardId,enabled,volume})}),data=await response.json();if(!response.ok)throw Error(data.error||'Action failed.');
  if(action==='invite'){setLink(data.url);setMessage('Send this private link to Trash. It expires in 15 minutes and works once.');}
  else if(action==='rewards'){setRewards(data.rewards);setMessage(data.rewards.length?'Choose the Scotland reward below.':'No rewards found. Create a custom reward in Twitch, then reload this list.');}
  else if(action==='local-test')setMessage('Queued locally. Keep the overlay tab open to play it. No Twitch points were used.');
  else{await refresh();setMessage(action==='save'?'Channel-point settings saved.':action==='subscribe'?'Subscription requested. Refresh status in a few seconds.':'Playback stopped and queue cleared.');}
 }catch(error){setMessage(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}}
 return <details className="settings-section" onToggle={event=>{if(event.currentTarget.open&&!status&&!busy)void run('refresh');}}><summary><span><strong>Channel-point videos</strong><small>Twitch connection, Scotland reward and playback</small></span><span className="settings-chevron" aria-hidden="true">⌄</span></summary><div className="settings-section-body points-settings">
 <p>Play the full Scotland Forever video through the existing 1920 × 1080 production overlay. Giveaways and their results are unchanged.</p>
 <button type="button" disabled={busy} onClick={()=>void run('refresh')}>Refresh connection</button>
 {status&&<>
 <p><strong>{status.local?'Local preview · live activation blocked':status.connected?'Connected: '+status.login:'Broadcaster not connected'}</strong><br/>Twitch events: {status.subscriptionStatus.replaceAll('_',' ')}</p>
 {!status.configured&&<p>Twitch application credentials must be configured before connecting.</p>}
 {status.local?<p>Test the video and shared queue below. Connection links, Twitch subscriptions and real redemptions stay disabled locally.</p>:<>
 <label>Twitch developer callback URL<input readOnly value={status.callback}/></label>
 <p>Add this address to the existing Twitch application’s OAuth Redirect URLs before the call.</p>
 <div className="points-actions"><button type="button" disabled={busy||!status.configured} onClick={()=>void run('invite')}>Create connection link</button><button type="button" disabled={busy||!status.connected} onClick={()=>void run('subscribe')}>Connect / repair Twitch events</button></div>
 {link&&<label>Private connection link<input readOnly value={link}/><button type="button" onClick={()=>void navigator.clipboard.writeText(link).then(()=>setMessage('Connection link copied.'),()=>setMessage('Select the link above and copy it.'))}>Copy link</button></label>}
 <div className="points-actions"><button type="button" disabled={busy||!status.connected} onClick={()=>void run('rewards')}>Load Twitch rewards</button></div>
 </>}
 <div className="prize-fields"><label>Twitch reward<select value={rewardId} disabled={busy||status.local} onChange={event=>setRewardId(event.target.value)}><option value="">Select a reward</option>{rewardId&&!rewardList.some(reward=>reward.id===rewardId)&&<option value={rewardId}>Saved reward · load list to view name</option>}{rewardList.map(reward=><option key={reward.id} value={reward.id} disabled={!reward.enabled}>{reward.title} · {reward.cost.toLocaleString()} points{reward.enabled?'':' (paused)'}</option>)}</select></label><label>Video volume · {Math.round(volume*100)}%<input type="range" min="0" max="1" step="0.05" value={volume} onChange={event=>setVolume(Number(event.target.value))}/></label></div>
 <label className="boss-activation"><input type="checkbox" checked={enabled} disabled={busy||status.local} onChange={event=>setEnabled(event.target.checked)}/> Enable channel-point videos</label>
 <div className="points-actions"><button type="button" disabled={busy} onClick={()=>void run('save')}>Save video settings</button>{status.local&&<button type="button" disabled={busy} onClick={()=>void run('local-test')}>Queue Scotland test in local overlay</button>}<button type="button" disabled={busy} onClick={()=>void run('stop')}>Stop playback / clear queue</button></div>
 <div className="points-actions"><a href="/claw-production?preview=1&clip=scotland" target="_blank" rel="noopener noreferrer">Preview Scotland ↗</a><a href="/claw-production" target="_blank" rel="noopener noreferrer">Open shared OBS overlay ↗</a></div>
 <p>The clip is 68 seconds and intentionally loud. Set the reward cost and a suggested 10–15 minute cooldown in Twitch. Clips queue without overlapping the claw intro. Keep OBS open; queued clips expire after 15 minutes.</p>
 <p>Redemptions remain in Twitch’s reward queue for manual completion or refund. “Started” means the overlay was instructed to play, not that OBS has confirmed it was on stream. Check expired or full-queue entries before completing them.</p>
 {status.receipts.length>0&&<div className="points-receipts"><strong>Recent redemptions</strong>{status.receipts.map(receipt=><div key={receipt.redemption_id}><span>{receipt.viewer}</span><span>{receipt.status.replaceAll('_',' ')}</span><time>{new Date(receipt.received_at).toLocaleString()}</time></div>)}</div>}
 </>}
 {message&&<p role="status">{message}</p>}
 </div></details>;
}
