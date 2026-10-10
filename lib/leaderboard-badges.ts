import 'server-only';
import {siteDb} from './site-db';
import {trackerHunts} from './site-tracker';
import {communityState,communityTracker} from './community-local';
import {achievementBadges,recordedCalls,viewerKey,type StatsHunt} from './community-stats';
export async function withLeaderboardBadges(players:Record<string,unknown>[]) {
 const name=(p:Record<string,unknown>)=>String(p.username||p.name||p.display_name||'');
 const names=players.map(name).filter(Boolean);if(!names.length)return players;
 const [links,native,state]=await Promise.all([siteDb().from('roulo_links').select('roulo_username,twitch_username,role').in('roulo_username',[...new Set(names.flatMap(n=>[n,n.toLowerCase()]))]),trackerHunts(),communityState()]);
 if(links.error)throw links.error;
 const community=state.hunts.filter(h=>!h.deleted),rows=recordedCalls([...native,...community.map(communityTracker)] as StatsHunt[]);
 const participation=community.map(h=>({id:h.id,phase:h.phase,members:h.members.map(m=>({name:m.name,status:m.status}))}));
 return players.map(p=>{const link=(links.data||[]).find(l=>viewerKey(l.roulo_username||'')===viewerKey(name(p)));const badges=link?.twitch_username?achievementBadges(link.twitch_username,participation,rows,new Date().toISOString()).filter(b=>b.earned).map(({id,icon,name,description})=>({id,icon,name,description})):[];if(link?.role==='vip')badges.unshift({id:'vip',icon:'👑',name:'VIP',description:'Stored site VIP status'});return {...p,badges};});
 // Only add badge labels to already-public leaderboard players; never return account mappings.
}
