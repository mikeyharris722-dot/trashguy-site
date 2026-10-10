"use client";
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {achievementBadges,recordedCalls,viewerKey,type ParticipationHunt,type StatsHunt} from '@/lib/community-stats';
export type Badge={id:string;icon:string;name:string;description:string};
const BadgeContext=createContext<{badges:Record<string,Badge[]>;vipUsers:string[] }>({badges:{},vipUsers:[]});
export function UserBadgeProvider({children}:{children:ReactNode}) {
 const [data,setData]=useState<{hunts:StatsHunt[];participation:ParticipationHunt[]}>({hunts:[],participation:[]});
 const [vipUsers,setVipUsers]=useState<string[]>([]);
 const [now,setNow]=useState(()=>new Date().toISOString());
 const load=useCallback(async(signal?:AbortSignal)=>{try{const [hr,pr,vr]=await Promise.all([fetch('/api/site-tracker',{signal}),fetch('/api/community',{signal}),fetch('/api/vip-badges',{signal})]);if(!hr.ok||!pr.ok)return;const [h,p]=await Promise.all([hr.json(),pr.json()]);if(vr.ok){const v=await vr.json();if(!signal?.aborted)setVipUsers(v.users||[]);}if(!signal?.aborted){setData({hunts:h.hunts||[],participation:p.hunts||[]});setNow(new Date().toISOString());}}catch{}},[]);
 useEffect(()=>{const c=new AbortController();const refresh=()=>{if(document.visibilityState==='visible')void load(c.signal)};const first=setTimeout(refresh,0);const timer=setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);return()=>{clearTimeout(first);clearInterval(timer);c.abort();document.removeEventListener('visibilitychange',refresh)}},[load]);
 const badges=useMemo(()=>{const rows=recordedCalls(data.hunts);const names=new Set(rows.map(r=>r.username));for(const h of data.participation)for(const m of h.members)if(m.status==='accepted')names.add(m.name);const map:Record<string,Badge[]>={};for(const name of names)if(name?.trim())map[viewerKey(name)]=achievementBadges(name,data.participation,rows,now).filter(b=>b.earned);return map;},[data,now]);
 return <BadgeContext.Provider value={{badges,vipUsers}}>{children}</BadgeContext.Provider>;
}
export default function UserBadges({name,platform='twitch',badges:explicit}:{name:string;platform?:'twitch'|'roulo';badges?:Badge[]}) {
 const context=useContext(BadgeContext);
 const key=platform==='roulo'?'':viewerKey(name||'');
 let badges=explicit || context.badges[key]||[];
 if(!explicit && platform==='twitch' && context.vipUsers.some(n=>viewerKey(n)===viewerKey(name)))badges=[{id:'vip',icon:'👑',name:'VIP',description:'Existing profile VIP status'},...badges];
 if(!badges.length)return null;
 return <span className="user-badges" aria-label={badges.map(b=>b.name).join(', ')}>{badges.map(b=><span key={b.id} className={b.id==='vip'?'user-badge vip':'user-badge'} title={b.name+' · '+b.description} aria-label={b.name}>{b.icon}</span>)}</span>;
}

export function useViewerVip(name:string){const c=useContext(BadgeContext);return c.vipUsers.some(n=>viewerKey(n)===viewerKey(name));}
