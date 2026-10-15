"use client";
import { startPolling } from "@/lib/polling";
import {useEffect,useState} from 'react';
import {siteFetch} from '@/lib/site-fetch';
import type {PrizeSettings} from '@/lib/prize-settings';
import {periodLabel} from './leaderboard';
import {leaderboardPeriods,type LeaderboardPeriod} from '@/lib/leaderboard-data';
const money=(v:number)=>v.toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function LeaderboardTotals({settings}:{settings:PrizeSettings}){
 const [period,setPeriod]=useState(settings.leaderboardStart),[data,setData]=useState<{totals:{affiliates:number;totalWagered:number;weightedWagered:number};periods:LeaderboardPeriod[]}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let stopped=false;const controller=new AbortController();async function load(){try{const r=await siteFetch('/api/admin/leaderboard-totals?period='+encodeURIComponent(period),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),cache:'no-store'}),body=await r.json();if(!r.ok)throw Error(body.error||'Totals unavailable.');if(!stopped){setData(body);setError('');}}catch(e){if(!stopped)setError(e instanceof Error?e.message:'Totals unavailable.');return false;}}const timer = startPolling(load, 60000);return()=>{stopped=true;controller.abort();timer();};},[period,retry]);
 return <section className="lb-admin-totals"><h3>All code affiliates · Monthly totals</h3><p>Includes every affiliate returned by Roulo, not just the top 10. Refreshes with the leaderboard every minute.</p><label>Month<select aria-label="Affiliate totals period" value={period} onChange={e=>{setPeriod(e.target.value);setData(null);setError('');}}>{(data?.periods||leaderboardPeriods(settings,Date.parse(settings.leaderboardEnd+"T00:00:00Z")-1)).map(p=><option value={p.start} key={p.start}>{periodLabel(p)}</option>)||<option value={period}>{periodLabel({start:settings.leaderboardStart,end:settings.leaderboardEnd})}</option>}</select></label>{error?<p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>:data?<dl><div><dt>Total wager</dt><dd>{money(data.totals.totalWagered)}</dd></div><div><dt>Total weighted wager</dt><dd>{money(data.totals.weightedWagered)}</dd></div><div><dt>Affiliates</dt><dd>{data.totals.affiliates}</dd></div></dl>:<p role="status">Loading monthly totals…</p>}</section>;
}
