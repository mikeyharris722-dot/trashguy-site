"use client";
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
type Player = {id:string;username:string};
export default function CommunityApprovedPlayer({busy,closed,save}:{busy:boolean;closed:boolean;save:(body:Record<string,unknown>)=>Promise<boolean>}) {
  const [query,setQuery]=useState(''),[players,setPlayers]=useState<Player[]>([]),[selected,setSelected]=useState<Player|null>(null),[amount,setAmount]=useState(''),[status,setStatus]=useState('');
  useEffect(()=>{
    if(selected || closed || query.trim().length<2)return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setStatus('Searching…');
      try {
        const {data}=await supabaseBrowser.auth.getSession();
        const response=await fetch('/api/admin/tracker-users?q='+encodeURIComponent(query.trim()),{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]),headers:{Authorization:'Bearer '+(data.session?.access_token||'')}});
        const body=await response.json();if(!response.ok)throw Error(body.error||'Search unavailable.');
        if(!controller.signal.aborted){setPlayers(body.users||[]);setStatus(body.users?.length?'':'No matching site players.');}
      } catch(error){if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'Search unavailable.');}
    },250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,selected,closed]);
  return <details className="community-settings mt-3">
    <summary>Add approved player</summary>
    <form onSubmit={async e=>{e.preventDefault();if(!selected||busy||closed)return;if(await save({userId:selected.id,amount})){setSelected(null);setQuery('');setAmount('');setPlayers([]);setStatus('');}}}>
      <div className="hunt-create-row">
        <div className="min-w-0">
          <label htmlFor="community-player-search">Site player</label>
          <input id="community-player-search" type="search" aria-label="Find community hunt player" className="mt-1 block w-full min-w-0 rounded-lg border border-purple-300/20 bg-black px-3 py-2 text-sm text-white" placeholder="Search Twitch username…" value={selected?.username||query} disabled={busy||closed||!!selected} onChange={e=>{setQuery(e.target.value);setPlayers([]);setStatus('');}}/>
          {selected ? <button type="button" className="mt-2 text-xs text-purple-200 underline" disabled={busy||closed} onClick={()=>{setSelected(null);setQuery('');}}>Change player</button> : <div role="status" className="mt-2 space-y-1 text-xs text-white/60">{status}{!closed&&query.trim().length>=2&&players.map(player=><button key={player.id} type="button" disabled={busy} className="block min-h-9 w-full break-words rounded-lg border border-purple-300/20 bg-purple-400/10 px-3 py-2 text-left text-white" onClick={()=>{setSelected(player);setPlayers([]);setStatus('');}}>{player.username}</button>)}</div>}
        </div>
        <label>Contribution (USD)<input aria-label="Approved player contribution in USD" type="number" inputMode="decimal" min="0.01" max="1000000000000" step="0.01" required disabled={busy||closed} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      </div>
      <p className="text-xs text-white/60">{closed?'Adding players is unavailable once opening begins or before the exchange rate is set.':'Adds this player as approved immediately. Their USD equity updates the bankroll using this hunt’s saved rate.'}</p>
      <button type="submit" className="primary-button" disabled={busy||closed||!selected||!amount}>{busy?'Adding…':'Add approved player'}</button>
    </form>
  </details>;
}
