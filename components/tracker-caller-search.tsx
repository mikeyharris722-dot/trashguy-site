"use client";
import {useEffect,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase/client";
type SiteUser={id:string;username:string};
export default function TrackerCallerSearch({selected,onSelect}:{selected:SiteUser|null;onSelect:(user:SiteUser|null)=>void}) {
 const [query,setQuery]=useState(""),[users,setUsers]=useState<SiteUser[]>([]),[status,setStatus]=useState("");
 useEffect(()=>{
  if(selected||query.trim().length<2)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setStatus("Searching…");setUsers([]);
   try {
    const {data}=await supabaseBrowser.auth.getSession();
    const response=await fetch("/api/admin/tracker-users?q="+encodeURIComponent(query.trim()),{signal:controller.signal,cache:"no-store",headers:{Authorization:"Bearer "+(data.session?.access_token||"")}});
    const body=await response.json();if(!response.ok)throw Error(body.error||"Search unavailable.");
    if(!controller.signal.aborted){setUsers(body.users||[]);setStatus(body.users?.length?"":"No matching site users.");}
   }catch(error){if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:"Search unavailable.");}
  },250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[query,selected]);
 return <div className="space-y-2 text-xs text-white/60">
 <label className="block">Called by (optional)
 <input type="search" aria-label="Find site user for bonus" className="mt-1 w-full min-w-0 rounded-lg border border-purple-300/20 bg-black px-3 py-2 text-sm text-white" placeholder="Start typing a Twitch username…" value={selected?.username||query} disabled={!!selected} onChange={e=>{setQuery(e.target.value);setUsers([]);setStatus("");}} /></label>
 {selected?<div className="flex items-center justify-between gap-2 rounded-lg border border-purple-300/20 p-2"><strong className="text-purple-100">{selected.username}</strong><button type="button" className="min-h-9 px-2 text-white" onClick={()=>{onSelect(null);setQuery("");setUsers([]);setStatus("");}}>Clear user</button></div>:query.trim().length>=2&&<div role="status">{status}{users.map(user=><button type="button" className="block min-h-10 w-full rounded-lg border border-purple-300/20 bg-purple-400/10 px-3 py-2 text-left text-white" key={user.id} onClick={()=>{onSelect(user);setUsers([]);setStatus("");}}>{user.username}</button>)}</div>}
 <p>{selected?"This slot’s recorded payout will count toward their Trash Boss progress for the leaderboard period.":"Choose a registered Twitch user to credit their call. Leave empty for an unassigned bonus."}</p>
 </div>;
}
