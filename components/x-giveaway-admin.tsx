"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { siteFetch } from '@/lib/site-fetch';
import { eligibleEntries, importEntries, postInfo, username, type XEntry, type XSnapshot } from '@/lib/x-giveaway';
import { CashWheelFace } from './trash-cash-wheel';
const field = 'w-full min-w-0 rounded-lg border border-purple-300/20 bg-black/40 p-2 text-sm';
function savedAngle(s: XSnapshot) { return s.draw ? (360 - (s.draw.index + .5) * 360 / s.entries.length) % 360 : 0; }
const button = 'rounded-xl border border-purple-300/30 px-3 py-2 text-sm font-bold disabled:opacity-40';
async function request(body?: object) { const res = await siteFetch('/api/admin/x-giveaways', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined); const data = await res.json(); if (!res.ok)
    throw Error(data.error || 'Could not save giveaway.'); return data; }
export default function XGiveawayAdmin() {
    const [entries, setEntries] = useState<XEntry[]>([]), [postUrl, setPostUrl] = useState(''), [author, setAuthor] = useState('trashguy__'), [excluded, setExcluded] = useState(''), [manual, setManual] = useState('');
    const [fetchLimited,setFetchLimited]=useState(false),[collectionId,setCollectionId]=useState<string|undefined>();
    const [urlDraft, setUrlDraft] = useState('');
    const [partialNotice,setPartialNotice]=useState('');
    const [snapshot, setSnapshot] = useState<XSnapshot | null>(null), [history, setHistory] = useState<XSnapshot[]>([]), [winner, setWinner] = useState<XEntry | null>(null);
    const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [spinning, setSpinning] = useState(false), [rotation, setRotation] = useState(0), [message, setMessage] = useState(''), [modal, setModal] = useState(false);
    const dialog = useRef<HTMLElement>(null);
    useEffect(() => { if (!modal)
        return; const previous = document.activeElement as HTMLElement | null; dialog.current?.focus(); return () => previous?.focus(); }, [modal]);
    const lock = useRef(false), pending = useRef<string | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => { let active = true; request().then((data: {
        snapshots: XSnapshot[]; collections?: {id:string;limited?:boolean}[];
    }) => { if (!active)
        return; setHistory(data.snapshots); const last = data.snapshots.at(-1); if (last) {
        setSnapshot(last.draw ? last : null);
        setPartialNotice(last.collectionWarning||'');setEntries(last.entries);setCollectionId(last.collectionId);setFetchLimited(!!data.collections?.find((c:{id:string;limited?:boolean})=>c.id===last.collectionId)?.limited);
        setPostUrl(last.postUrl);
        setUrlDraft(last.postUrl);
        setAuthor(last.author);
        setExcluded(last.excluded.join(', '));
        setWinner(last.draw?.winner || null);
        setRotation(savedAngle(last));
    } }).catch(e => { if (active)
        setMessage(e.message); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; if (timer.current)
        clearTimeout(timer.current); }; }, []);
    const preview = useMemo(() => { try {
        const info = postInfo(postUrl), blocked = excluded.split(/[\s,;]+/).filter(Boolean).map(username);
        return { ...eligibleEntries(entries, info.author || author, blocked), error: '', blocked, author: info.author || author };
    }
    catch (e) {
        return { entries: [] as XEntry[], raw: entries.length, duplicates: 0, exclusions: 0, error: (e as Error).message, blocked: [], author: '' };
    } }, [entries, postUrl, author, excluded]);
    const frozen = !!snapshot, disabled = loading || busy || spinning || frozen;
    function edit() { setSnapshot(null); setWinner(null); setRotation(0); pending.current = null; setMessage('Entries unlocked. The previous snapshot and result remain in history.'); }
    function replace(next: XEntry[]) { setPartialNotice('');setEntries(next); setFetchLimited(false); setCollectionId(undefined); pending.current = null; setWinner(null); setMessage('Import ready for review.'); }
    async function fetchReplies(){
        if(lock.current||loading||busy||spinning)return;
        lock.current=true;setBusy(true);setMessage('Fetching reply usernames…');
        try{
            const info=postInfo(urlDraft);if(!info.postUrl)throw Error('Enter an X post URL.');
            // Clear stale names before starting a different post, including on failure.
            if(info.postUrl!==postUrl){setPartialNotice('');setEntries([]);setSnapshot(null);setWinner(null);setFetchLimited(false);setCollectionId(undefined);}
            let job=await request({action:'fetch',postUrl:info.postUrl});
            let pollFailures=0;
            for(let i=0;i<110&&job.status==='running';i++){
                await new Promise(r=>setTimeout(r,2000));
                try{job=await request({action:'fetchStatus',id:job.id});pollFailures=0;setMessage(job.message||'Collecting replies. Checking the same saved run…');}
                catch(e){if(++pollFailures>=3)throw e;setMessage('Connection interrupted. Checking the same saved run; no duplicate collection is started…');}
            }
            if(job.status!=='succeeded')throw Error(job.message||'Collection is still running. Click Fetch replies again to check it without starting a duplicate.');
            const saved:XSnapshot=await request({action:'snapshot',requestId:crypto.randomUUID(),postUrl:info.postUrl,entries:job.entries,excluded:preview.blocked,collectionId:job.id});
            setHistory(h=>[...h,saved]);setCollectionId(job.id);setPartialNotice(saved.collectionWarning||'');
            setEntries(job.entries);setPostUrl(info.postUrl);setUrlDraft(info.postUrl);setAuthor(info.author);setSnapshot(null);setWinner(null);setRotation(0);pending.current=null;setFetchLimited(job.limited===true);
            setMessage(job.raw+' replies retrieved · '+new Date(job.startedAt).toLocaleString()+'. '+job.message+' Results are cached for 5 minutes.');
        }catch(e){setMessage((e as Error).message);}finally{lock.current=false;setBusy(false);}
    }
    async function spin() {
        if (lock.current || loading || spinning || snapshot?.draw || fetchLimited || preview.error || !preview.entries.length)
            return;
        lock.current = true;
        setBusy(true);
        setMessage('Saving a frozen participant snapshot…');
        try {
            let saved = snapshot;
            if (!saved) {
                pending.current ||= crypto.randomUUID();
                saved = await request({ action: 'snapshot', requestId: pending.current, entries, postUrl, author: preview.author, excluded: preview.blocked, collectionId });
                setSnapshot(saved);
                setEntries(saved!.entries);
                setHistory(h => [...h.filter(s => s.id !== saved!.id), saved!]);
            }
            const drawn: XSnapshot = await request({ action: 'draw', snapshotId: saved!.id });
            setSnapshot(drawn);
            setHistory(h => [...h.filter(s => s.id !== drawn.id), drawn]);
            const target = (360 - (drawn.draw!.index + .5) * 360 / drawn.entries.length) % 360;
            setWinner(null);
            setModal(true);
            setMessage('');
            setSpinning(true);
            // First paint the unrotated wheel before starting its original five-second transition.
            requestAnimationFrame(() => requestAnimationFrame(() => setRotation(old => old + 1800 + (target - old % 360 + 360) % 360)));
            timer.current = setTimeout(() => { setWinner(drawn.draw!.winner); setSpinning(false); lock.current = false; }, 5100);
        }
        catch (e) {
            setMessage((e as Error).message + ' Retry Spin to recover the same saved draw.');
            lock.current = false;
        }
        finally {
            setBusy(false);
        }
    }
    function next(remove: boolean) { if (!snapshot?.draw)
        return; const old = snapshot; edit(); setEntries(remove ? old.entries.filter((_, i) => i !== old.draw!.index) : old.entries); setModal(false); }
    function download() { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), snapshots: history }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'trash-x-giveaways.json'; a.click(); URL.revokeObjectURL(url); }
    const names = (snapshot?.entries || preview.entries).map(e => '@' + e.username);
    const winnerPanel = <div role="status" aria-live="polite" className="mt-3 min-h-8 text-center text-xl font-black text-emerald-300">{spinning ? 'Good luck!' : winner ? <><span className="block text-xs text-white/50">WINNER</span><a className="break-all underline" href={'https://x.com/' + winner.username} target="_blank" rel="noopener noreferrer">@{winner.username}</a></> : ''}</div>;
    const controls = <div className="mt-3 flex flex-wrap gap-2">{!snapshot?.draw ? <button className={button + ' flex-1 bg-purple-600'} disabled={loading || busy || spinning || fetchLimited || urlDraft !== postUrl || !!preview.error || !names.length} onClick={spin}>{busy ? 'Saving…' : spinning ? 'Spinning…' : 'Spin'}</button> : <><button className={button + ' flex-1'} disabled={spinning} onClick={() => next(false)}>Keep winner & prepare next</button><button className={button + ' flex-1 bg-purple-600'} disabled={spinning} onClick={() => next(true)}>Remove winner & prepare next</button></>}</div>;
    return <section className="mt-4 min-w-0 rounded-2xl border border-purple-300/20 bg-black/60 p-3 text-white sm:p-5">
    <h2 className="text-lg font-black">𝕏 Twitter Giveaway</h2>
    <p className="mt-1 text-xs text-white/60">Paste a post URL and fetch its reply usernames, or import a CSV below. Review the accounts before spinning.</p>
    <fieldset disabled={loading || busy || spinning} className="mt-3 flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs">X post URL<input className={field + ' mt-1'} value={urlDraft} onChange={e => { setUrlDraft(e.target.value); pending.current = null; }} placeholder="https://x.com/trashguy__/status/…"/></label><button className={button + ' shrink-0 bg-purple-600'} onClick={fetchReplies}>{busy ? 'Fetching…' : 'Save & fetch replies'}</button></fieldset>
    {urlDraft !== postUrl && <p className="mt-1 text-xs text-amber-200">New URL — fetch replies to load its accounts.</p>}
    {snapshot && <button disabled={busy || spinning} className={button + ' mt-3'} onClick={edit}>Edit / start a new snapshot</button>}
    <p role="alert" className="my-3 text-sm text-amber-200">{loading ? 'Loading saved giveaways…' : preview.error || message}</p>
    {partialNotice&&<p role="status" className="mb-3 rounded-lg border border-amber-300/40 bg-amber-900/20 p-3 text-sm text-amber-100">{partialNotice}</p>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div className="min-w-0 rounded-xl border border-purple-300/20 bg-[#100817] p-3"><h3 className="text-sm font-black">{names.length} eligible participants</h3><p className="mt-1 text-xs text-white/50">{snapshot ? 'Frozen snapshot' : `${preview.raw} imported rows · ${preview.duplicates} duplicates · ${preview.exclusions} excluded`} · Trash is always excluded</p>
        {names.length > 0 ? <CashWheelFace labels={names} rotation={rotation} spinning={spinning} usernames label="Twitter username giveaway wheel"/> : <p className="py-12 text-center text-white/40">Import accounts to fill the wheel.</p>}
        {names.length > 50 && <p className="text-xs text-white/50">All {names.length} labels are on the wheel. At this size, use the complete list to read names.</p>}{!modal && winnerPanel}{controls}<button className={button + ' mt-2 w-full'} disabled={!names.length || busy || spinning} onClick={() => setModal(true)}>Open stream view</button>
      </div>
      <div className="min-w-0"><h3 className="font-bold">Complete participant list ({names.length})</h3><ol className="mt-2 max-h-[32rem] overflow-y-auto rounded-xl border border-white/10 p-3 text-sm">{(snapshot?.entries || preview.entries).map((e, i) => <li key={e.accountId || e.username.toLowerCase()} className="flex items-center justify-between gap-2 border-b border-white/5 py-1"><a className="min-w-0 break-all text-purple-200" href={'https://x.com/' + e.username} target="_blank" rel="noopener noreferrer">{i + 1}. @{e.username}</a>{!disabled && <button className="shrink-0 text-xs text-white/50" aria-label={'Remove @' + e.username} onClick={() => { setExcluded(current => [current, "@" + e.username].filter(Boolean).join(", ")); pending.current = null; }}>Remove</button>}</li>)}</ol></div>
    </div>
    <details className="mt-4 rounded-xl border border-purple-300/20 bg-black/40 p-3"><summary className="cursor-pointer text-sm font-bold">Import CSV, manual entries & exclusions</summary><div className="mt-3">    <details className="my-3 rounded-lg border border-white/10 p-3 text-xs text-white/70"><summary className="cursor-pointer font-bold">Get a free reply CSV</summary><p className="mt-2">Open <a className="text-purple-300 underline" href="https://commentpicker.com/twitter-export.php" target="_blank" rel="noopener noreferrer">Comment Picker’s X Export</a>, select Replies, paste your post link and export CSV. The free allowance is currently 25 rows, one daily and three monthly exports. Import the file below. Nested or unavailable replies may be missing. Use Fetch replies above for automatic collection within the free allowance.</p></details>
    <fieldset disabled={disabled} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <button className={button + ' sm:col-span-2'} onClick={() => { replace([]); setManual(''); }}>Clear imported entries</button>
      <label className="text-xs">Post author (when no URL)<input className={field + ' mt-1'} value={author} onChange={e => { setAuthor(e.target.value); pending.current = null; }} placeholder="trashguy__"/></label>
      <label className="text-xs">Excluded usernames<input className={field + ' mt-1'} value={excluded} onChange={e => { setExcluded(e.target.value); pending.current = null; }} placeholder="@name, @another"/></label>
      <label className="text-xs sm:col-span-2">Import CSV (replaces current import)<input className={field + ' mt-1'} type="file" accept=".csv,text/csv" onChange={async (e) => { const file = e.target.files?.[0]; if (!file)
        return; try {
        if (file.size > 2000000)
            throw Error('Maximum file size is 2 MB.');
        replace(importEntries(await file.text()));
    }
    catch (err) {
        setMessage((err as Error).message);
    } e.target.value = ''; }}/></label>
      <label className="text-xs sm:col-span-2">Manual usernames (one per line)<textarea className={field + ' mt-1'} rows={3} value={manual} onChange={e => setManual(e.target.value)} placeholder="@username"/><button className={button + ' mt-2'} onClick={() => { try {
        replace([...entries, ...importEntries(manual, true)]);
        setManual('');
    }
    catch (e) {
        setMessage((e as Error).message);
    } }}>Add usernames</button></label>
    </fieldset>
    </div></details>
    <div className="mt-4 border-t border-white/10 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Saved draws & snapshots</h3><button className={button} disabled={!history.length} onClick={download}>Export record (JSON)</button></div><ul className="mt-2 max-h-48 overflow-auto text-xs text-white/60">{history.slice().reverse().map(s => <li key={s.id} className="flex flex-wrap justify-between gap-2 border-b border-white/10 py-2"><span>{new Date(s.draw?.createdAt || s.createdAt).toLocaleString()} · {s.entries.length} accounts · {s.draw ? '@' + s.draw.winner.username : 'Not drawn'}</span><button className="text-purple-300 underline" disabled={busy || spinning} onClick={() => { setSnapshot(s);setPartialNotice(s.collectionWarning||''); setEntries(s.entries);setCollectionId(s.collectionId);setFetchLimited(false); setPostUrl(s.postUrl); setUrlDraft(s.postUrl); setAuthor(s.author); setExcluded(s.excluded.join(', ')); setWinner(s.draw?.winner || null); setRotation(savedAngle(s)); pending.current = null; }}>View snapshot</button></li>)}</ul></div>
    {modal && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm"><section ref={dialog} tabIndex={-1} onKeyDown={e => { if (e.key === 'Escape' && !spinning)
        setModal(false); if (e.key === 'Tab') {
        const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]'));
        if (!nodes.length) {
            e.preventDefault();
            return;
        }
        if (e.shiftKey && (document.activeElement === nodes[0] || document.activeElement === dialog.current)) {
            e.preventDefault();
            nodes.at(-1)?.focus();
        }
        else if (!e.shiftKey && (document.activeElement === nodes.at(-1) || document.activeElement === dialog.current)) {
            e.preventDefault();
            nodes[0]?.focus();
        }
    } }} role="dialog" aria-modal="true" aria-label="Twitter giveaway wheel" className="max-h-[94vh] w-full max-w-lg overflow-auto rounded-2xl border border-purple-300/30 bg-[#100817] p-4 shadow-2xl"><div className="flex justify-between gap-3"><h2 className="text-lg font-black">𝕏 TWITTER GIVEAWAY</h2><button autoFocus className={button} disabled={spinning} onClick={() => setModal(false)}>Close</button></div><CashWheelFace labels={names} rotation={rotation} spinning={spinning} usernames label="Twitter username giveaway wheel"/>{partialNotice&&<p className="mt-2 text-xs text-amber-200">{partialNotice}</p>}{winnerPanel}{controls}</section></div>}
  </section>;
}
