"use client";
import Image from 'next/image';
import UserBadges, {useViewerVip} from './user-badges';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { siteFetch } from '@/lib/site-fetch';
import { providerName } from '@/lib/slot-providers';
import { groupCalls, sortStatGroups, type StatsSort, slotKey, achievementBadges, monthKey, recordedCalls, summarizeCalls, viewerKey, type ParticipationHunt, type StatsHunt } from '@/lib/community-stats';
const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mult = (n: number | null) => n === null ? '—' : n.toFixed(2) + '×';
const monthLabel = (m: string) => new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m + '-01T12:00:00Z'));
function SlotThumb({src}:{src:string}) {const [failed,setFailed]=useState(false);return src&&!failed?<Image unoptimized src={src} alt="" width={36} height={36} className="stats-slot-image" onError={()=>setFailed(true)}/>:<span className="stats-slot-placeholder" aria-hidden="true">🎰</span>;}
export default function CommunityStats({ viewer }: {
    viewer?: string;
}) {
    const [sortBy,setSortBy]=useState<StatsSort>('calls');
    const [direction,setDirection]=useState<'asc'|'desc'>('desc');
    const vip=useViewerVip(viewer||'');
    const [selectedSlot, setSelectedSlot] = useState('');
    const [participation, setParticipation] = useState<ParticipationHunt[]>([]);
    const [hunts, setHunts] = useState<StatsHunt[]>([]), [queued, setQueued] = useState<{
        id: string;
        username: string;
        slot_name: string;
    }[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [tab, setTab] = useState('viewers'), [month, setMonth] = useState('all'), [query, setQuery] = useState(''), [page, setPage] = useState(0);
    const load = useCallback(async (signal?: AbortSignal) => { try {
        const [hr, cr, pr] = await Promise.all([siteFetch('/api/site-tracker', { cache: 'no-store', signal }), siteFetch('/api/slot-calls', { cache: 'no-store', signal }), siteFetch('/api/community', { cache: 'no-store', signal })]);
        if (!hr.ok || !cr.ok || !pr.ok)
            throw Error('Stats could not refresh. Please try again.');
        const [h, c, p] = await Promise.all([hr.json(), cr.json(), pr.json()]);
        setError('');
        setParticipation(p.hunts || []);
        setHunts(h.hunts || []);
        setQueued(c.calls || []);
    }
    catch (e) {
        if (!signal?.aborted)
            setError(e instanceof Error ? e.message : 'Stats could not load.');
    }
    finally {
        if (!signal?.aborted)
            setLoading(false);
    } }, []);
    useEffect(() => { const c = new AbortController(); const initial = setTimeout(() => void load(c.signal), 0); return () => { clearTimeout(initial); c.abort(); }; }, [load]);
    const all = useMemo(() => recordedCalls(hunts), [hunts]);
    const personal = Boolean(viewer);
    const rows = all.filter(r => (!viewer || viewerKey(r.username) === viewerKey(viewer)) && (month === 'all' || monthKey(r.date) === month));
    const months = [...new Set([...all.map(r => monthKey(r.date)), ...hunts.map(h => monthKey(h.updatedAt || h.createdAt || ''))].filter(Boolean))].sort().reverse();
    const totals = summarizeCalls(rows);
    const badges = achievementBadges(viewer || "", participation, all, new Date().toISOString());
    if(vip)badges.unshift({id:"vip",icon:"👑",name:"VIP",description:"Your existing profile VIP status",earned:true,progress:"No change to eligibility or giveaway odds"});
    const groups = groupCalls(rows, tab === 'slots' ? 'slot' : 'viewer').filter(g => g.name.toLowerCase().includes(query.toLowerCase()));
    if (tab === 'viewers' && !personal) {
      for (const h of participation.filter(h=>h.phase==='finished')) for (const m of h.members.filter(m=>m.status==='accepted')) {
        const key=viewerKey(m.name);
        if (!groups.some(g=>g.key===key) && m.name.toLowerCase().includes(query.toLowerCase()) && month==='all') groups.push({key,name:m.name,detail:'',artwork:'',...summarizeCalls([])});
      }
    }
    const sortedGroups=sortStatGroups(groups,sortBy,direction);
    const history = rows.filter(r => (r.slot_name + ' ' + r.huntTitle).toLowerCase().includes(query.toLowerCase()));
    const completed = hunts.filter(h => h.phase === 'finished' && (!viewer || h.entries.some(e => viewerKey(e.username) === viewerKey(viewer))) && (month === 'all' || monthKey(h.updatedAt || h.createdAt || '') === month));
    const recapRows = recordedCalls(completed), recap = summarizeCalls(recapRows);
    const headline = tab === 'recap' && !personal ? recap : totals;
    const biggest = recapRows.filter(r => r.amount !== null).sort((a, b) => (b.amount || 0) - (a.amount || 0))[0];
    const recapViewers = groupCalls(recapRows, "viewer").sort((a, b) => b.total - a.total);
    const listCount = personal ? history.length : groups.length;
    const currentPage = Math.min(page, Math.max(0, Math.ceil(listCount / 15) - 1));
    const chooseTab = (value: string) => { setSelectedSlot(''); setTab(value); setQuery(''); setPage(0); if (value === 'recap' && month === 'all')
        setMonth(months[0] || 'all'); };
    return <section className="stats-workspace workspace-panel" aria-label={personal ? 'My activity' : 'Community stats'}>
 <div className="workspace-heading"><div><p className="eyebrow">{personal ? 'Your stream history' : 'Trashguy community'}</p>{personal ? <h2>My activity</h2> : <h1 className="stats-title">Community Stats</h1>}<p>{personal ? 'Your recorded calls, collected bonuses and hunt results.' : 'Viewer calls, slot performance and completed hunt recaps.'}</p></div><button className="stats-button" onClick={() => void load()} disabled={loading}>Refresh</button></div>
 {!personal && <div className="stats-tabs" role="group" aria-label="Stats views">{[['viewers', 'Viewer calls'], ['slots', 'Slot performance'], ['recap', 'Monthly recap']].map(([id, label]) => <button className="stats-button" aria-pressed={tab === id} key={id} onClick={() => chooseTab(id)}>{label}</button>)}</div>}
 <div className="stats-controls"><label>Period<select value={month} onChange={e => { setMonth(e.target.value); setPage(0); }}><option value="all">All recorded history</option>{months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>{tab !== 'recap' && <label>{personal ? 'Find a call' : tab === 'slots' ? 'Find a slot' : 'Find a viewer'}<input type="search" value={query} placeholder={personal ? 'Slot or hunt name' : tab === 'slots' ? 'Slot name' : 'Twitch username'} onChange={e => { setQuery(e.target.value); setPage(0); }}/></label>}{!personal&&tab!=='recap'&&<><label>Order by<select value={sortBy} onChange={e=>{setSortBy(e.target.value as StatsSort);setPage(0);}}><option value="calls">Attempts</option><option value="collected">Got in</option><option value="collectionRate">Rate</option><option value="average">Avg ×</option><option value="best">Best ×</option></select></label><label>Direction<select value={direction} onChange={e=>{setDirection(e.target.value as 'asc'|'desc');setPage(0);}}><option value="desc">Highest first</option><option value="asc">Lowest first</option></select></label></>}</div>
 <p className="stats-explainer">Recorded hunt outcomes only—not every chat submission. Collection rate = collected bonuses ÷ recorded attempts. Average multiplier includes opened bonuses, including zero returns. These results do not predict future wins.</p>
 {error && <p className="form-error" role="alert">{error} Existing results are retained.</p>}
 {loading ? <p role="status">Loading recorded activity…</p> : <>
 {personal && <div className="participation-badges"><h3>Badges & achievements</h3><p className="stats-explainer">Participation levels count approved membership in completed Community Hunts: 1, 3, 5, 10 and 25 hunts. Call awards use cash payouts, not multipliers, and the Monday–Sunday London week. Awards use available payout/update dates and rotate with new results. Recognition only—no effect on prizes or giveaway odds.</p><div className="badge-grid">{badges.map(b => <div key={b.id} className={`participation-badge ${b.earned ? "earned" : "locked"}`}><span aria-hidden="true">{b.icon}</span><div><strong>{b.name}</strong><small>{b.description}</small><small>{b.earned ? "Earned · " : "Not earned · "}{b.progress}</small></div></div>)}</div></div>}
 <dl className="tracker-stats"><div><dt>Recorded attempts</dt><dd>{headline.calls}</dd></div><div><dt>Bonuses collected</dt><dd>{headline.collected}</dd></div><div><dt>Collection rate</dt><dd>{headline.collectionRate === null ? '—' : headline.collectionRate.toFixed(1) + '%'}</dd></div><div><dt>Average multiplier</dt><dd>{mult(headline.average)}</dd></div></dl>
 {personal && <details className="stats-membership"><summary>My Community Hunt participation</summary>{participation.filter(h=>h.members.some(m=>viewerKey(m.name)===viewerKey(viewer||''))).length ? participation.filter(h=>h.members.some(m=>viewerKey(m.name)===viewerKey(viewer||''))).map(h=>{const member=h.members.find(m=>viewerKey(m.name)===viewerKey(viewer||''))!;return <article className="stats-history-row" key={h.id}><div><strong>{h.title || 'Community Hunt'}</strong><small>{h.phase==='finished'?'Completed':h.phase==='opening'?'Opening bonuses':'Collecting bonuses'}</small></div><span>{member.status==='accepted'?'Approved':member.status==='pending'?'Awaiting approval':member.status}</span><span>{member.amount!==null && member.amount!==undefined ? money(Number(member.amount)) : '—'}</span></article>}) : <p className="stats-empty">No Community Hunt registrations recorded yet.</p>}</details>}
 {personal && queued.filter(c => viewerKey(c.username) === viewerKey(viewer || '')).map(c => <p className="stats-highlight" key={c.id}><strong>In the current call queue</strong> · {c.slot_name}</p>)}
 {tab === 'recap' && !personal ? <><p className="stats-explainer">Completed hunts are grouped by their last saved completion/update month (London time). Ongoing hunts are excluded from this recap.</p><div className="stats-recap"><div><span>Completed hunts</span><strong>{completed.length}</strong></div><div><span>Recorded returns</span><strong>{money(recap.total)}</strong></div><div><span>Hunt bankrolls</span><strong>{money(completed.reduce((n, h) => n + Number(h.startCost || 0), 0))}</strong></div><div><span>Best multiplier</span><strong>{mult(recap.best?.multiplier ?? null)}</strong><small>{recap.best ? recap.best.slot_name + ' · ' + recap.best.username : 'No opened bonuses recorded'}</small></div></div><div className="stats-highlight"><strong>Highest-paying call</strong> · {biggest ? biggest.slot_name + " · " + biggest.username + " · " + money(biggest.amount || 0) : "No recorded payouts"}{biggest && <UserBadges name={biggest.username} />}<br /><strong>Top viewer by total returns</strong> · {recapViewers[0] ? recapViewers[0].name + " · " + money(recapViewers[0].total) : "No recorded calls"}{recapViewers[0] && <UserBadges name={recapViewers[0].name} />}</div><h3>Completed hunts</h3>{completed.length ? completed.map(h => { const summary = summarizeCalls(recordedCalls([h])); return <article className="stats-history-row" key={h.id}><div><strong>Hunt {h.title}</strong><small>{h.casino} · {summary.opened} opened bonuses</small></div><span>{money(summary.total)}</span><span>{mult(summary.average)} average</span></article>; }) : <p className="stats-empty">No completed hunts in this period yet.</p>}</> : personal ? <><p className="stats-explainer">{totals.pending} collected bonuses still awaiting a payout · Best recorded result: {mult(totals.best?.multiplier ?? null)}</p>{history.slice(currentPage * 15, currentPage * 15 + 15).map(r => <article className="stats-history-row" key={r.huntId + ':' + r.id}><div><strong>{r.slot_name}</strong><small>Hunt {r.huntTitle} · {r.date ? new Date(r.date).toLocaleDateString('en-GB', { timeZone: 'Europe/London' }) : 'Date unavailable'}</small></div><span className="stats-outcome">{r.status === 'failed' ? "Didn't get in" : r.amount === null ? 'Got in · pending' : 'Opened'}</span><div><strong>{r.amount === null ? '—' : money(r.amount)}</strong><small>{mult(r.multiplier)}</small></div></article>)}</> : <div className="stats-table-wrap"><table className="stats-table"><caption>{tab === 'slots' ? 'Recorded slot performance' : 'Viewer call statistics'} · {({calls:"Attempts",collected:"Got in",collectionRate:"Rate",average:"Avg ×",best:"Best ×"})[sortBy]} · {direction==='desc'?'highest first':'lowest first'}</caption><thead><tr><th>{tab === 'slots' ? 'Slot' : 'Viewer'}</th><th>Attempts</th><th>Got in</th><th>Rate</th><th>Opened</th><th>Avg ×</th><th>Best ×</th>{tab === 'viewers' && <th>Badges</th>}</tr></thead><tbody>{sortedGroups.slice(currentPage * 15, currentPage * 15 + 15).map(g => <tr key={g.key}><th scope="row">{tab==='slots'?<button className="stats-slot-button" aria-expanded={selectedSlot===g.key} onClick={()=>setSelectedSlot(selectedSlot===g.key?'':g.key)}><SlotThumb key={g.artwork} src={g.artwork}/><span>{g.name}</span></button>:g.name}{tab === 'slots' && <small>{providerName(g.detail)}</small>}</th><td>{g.calls}</td><td>{g.collected}</td><td>{g.collectionRate===null?'—':g.collectionRate.toFixed(1)+'%'}</td><td>{g.opened}</td><td>{mult(g.average)}</td><td>{mult(g.best?.multiplier ?? null)}</td>{tab === 'viewers' && <td><div className="viewer-badges"><UserBadges name={g.name} /></div></td>}</tr>)}</tbody></table></div>}
 {tab==='slots' && selectedSlot && <section className="stats-slot-history" aria-label="Selected slot history"><h3>{groups.find(g=>g.key===selectedSlot)?.name || 'Slot history'}</h3><p className="stats-explainer">Latest 15 recorded attempts in the selected period.</p>{rows.filter(r=>slotKey(r)===selectedSlot).slice(0,15).map(r=><article className="stats-history-row" key={r.huntId+':'+r.id}><div><strong>Hunt {r.huntTitle}</strong><small>{r.username}<UserBadges name={r.username} /> · Bet {money(Number(r.bet_size))}</small></div><span>{r.status==='failed'?"Didn't get in":r.amount===null?'Got in · pending':money(r.amount)}</span><span>{mult(r.multiplier)}</span></article>)}</section>}
 {tab !== 'recap' && <>{!listCount && <p className="stats-empty">{personal ? 'No matching recorded calls yet.' : 'No matching results for this period.'}</p>}{listCount > 15 && <div className="stats-pagination"><button className="stats-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {Math.ceil(listCount / 15)}</span><button className="stats-button" disabled={(currentPage + 1) * 15 >= listCount} onClick={() => setPage(currentPage + 1)}>Next</button></div>}</>}
 </>}
 </section>;
}
