"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BOSSES, battleState, type BattleHunt, type BattleBonus } from '@/lib/boss-battle';
import TrashBoss from './trash-boss';
import styles from './boss-battle-preview.module.css';
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
export default function BossBattlePreview({ overlayOnly = false, initialSource = 'active', embedded = false }: {
    overlayOnly?: boolean;
    embedded?: boolean;
    initialSource?: 'test' | 'active';
}) {
    const [source, setSource] = useState(initialSource), [hunt, setHunt] = useState<BattleHunt | null>(null), [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [saving, setSaving] = useState(false);
    const [entry, setEntry] = useState<BattleBonus | null>(null), [payout, setPayout] = useState(''), [start, setStart] = useState('1000'), [skipped, setSkipped] = useState<string[]>([]), [opening, setOpening] = useState(false), [hit, setHit] = useState(false);
    useEffect(() => {
        let stopped = false;
        const controller = new AbortController();
        let previous = '';
        async function load() {
            try {
                const response = await fetch(`/api/boss-battle?source=${source}`, { cache: 'no-store', signal: controller.signal });
                const data = await response.json();
                if (!response.ok)
                    throw Error(data.error || 'Could not load hunt');
                if (stopped)
                    return;
                const next = data.hunt as BattleHunt | null;
                const signature = JSON.stringify(next?.bonuses.map(b => [b.id, b.payout]));
                if (previous && signature !== previous) {
                    setHit(true);
                }
                previous = signature;
                setHunt(next);
                setLoaded(true);
                setError('');
            }
            catch (e) {
                if (!stopped)
                    setError(e instanceof Error ? e.message : 'Could not load hunt');
            }
        }
        void load();
        const timer = setInterval(load, 1500);
        return () => { stopped = true; controller.abort(); clearInterval(timer); };
    }, [source]);
    useEffect(() => {
        if (!hit)
            return;
        const timer = setTimeout(() => setHit(false), 800);
        return () => clearTimeout(timer);
    }, [hit]);
    const dialogRef = useRef<HTMLElement>(null);
    useEffect(() => {
        if (!entry)
            return;
        const previous = document.activeElement as HTMLElement | null;
        dialogRef.current?.querySelector('input')?.focus();
        return () => previous?.focus();
    }, [entry]);
    const state = hunt ? battleState(hunt) : null;
    const latest = hunt?.latest || state?.opened.at(-1);
    function changeSource(value: 'test' | 'active') { setLoaded(false); setHunt(null); setEntry(null); setOpening(false); setSkipped([]); setSource(value); }
    async function save(body: Record<string, unknown>) {
        setSaving(true);
        setError('');
        try {
            const response = await fetch('/api/boss-battle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok)
                throw Error(data.error);
            setHunt(data.hunt);
            setHit(true);
            return data.hunt as BattleHunt;
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save');
            return null;
        }
        finally {
            setSaving(false);
        }
    }
    function choose(next: BattleBonus) { setEntry(next); setPayout(next.payout === null ? '' : String(next.payout)); }
    function nextBonus(current: BattleHunt, skip = skipped) { const pending = current.bonuses.filter(b => b.payout === null); return pending.find(b => !skip.includes(b.id)) || pending[0]; }
    async function confirm() {
        if (!entry)
            return;
        const next = await save({ action: 'payout', id: entry.id, payout });
        if (!next)
            return;
        const remaining = nextBonus(next);
        if (opening && remaining)
            choose(remaining);
        else {
            setEntry(null);
            setOpening(false);
        }
    }
    const arena = <section className={`${styles.arena} ${overlayOnly ? styles.overlayArena : ''}`} aria-label="Boss battle">
  <div className={styles.arenaTop}><span><i className={styles.liveDot}/>{source === 'test' ? 'LOCAL TEST HUNT' : 'ACTIVE HUNT'}</span><span>{state?.cleared || 0}/5 defeated</span></div>
  {!hunt || !state ? <div className={styles.empty}>{error || (loaded ? 'No active hunt. Select a hunt in the Bonus Hunt Tracker.' : 'Loading hunt…')}</div> : !state.valid ? <div className={styles.empty}>Set a starting bankroll in the tracker to begin the battle.</div> : <>
  <div className={styles.bossTitle}><div><span className={styles.eyebrow}>{state.finished ? 'ALL FIVE DEFEATED' : state.boss.title}</span><h2>{state.finished ? 'Hunt champions!' : state.boss.name}</h2></div><span className={styles.level}>{state.finished ? '🏆' : `BOSS ${state.index + 1}`}</span></div>
  <div className={styles.healthMeta}><span>{state.finished ? 'Victory' : `${money(state.remaining)} to defeat`}</span><strong>{money(state.total)} / {money(state.goal)}</strong></div>
  <div className={styles.health} role="progressbar" aria-label="Boss health" aria-valuemin={0} aria-valuemax={1000} aria-valuenow={state.hp}><div style={{ width: `${state.hp / 10}%` }}/></div>
  <div className={styles.monsterStage}><div className={styles.portal}/><div key={state.index} className={styles.bossBody}><TrashBoss hit={hit} defeated={state.finished} name={state.boss.name} variant={state.index}/></div>{state.finished && <div className={styles.victoryStamp}>ALL BOSSES DEFEATED</div>}</div>
  <div className={styles.latest}><span className={styles.attackIcon}>{state.finished ? '🏆' : '⚔️'}</span><div><strong>{latest ? latest.slotName : 'Ready for the first bonus'}</strong><small>{latest ? `${latest.username || 'Host'} · ${money(Number(latest.payout))} payout` : 'Opening bonuses damages the bosses'}</small></div><b>{money(Math.abs(state.profit))} {state.profit >= 0 ? 'profit' : 'to recover'}</b></div>
  </>}
 </section>;
    if (overlayOnly)
        return <div className={styles.overlayPage}><div className={styles.overlayFrame}>{arena}</div></div>;
    return <section className={`${styles.page} ${embedded ? styles.embedded : ""}`}>{!embedded && <nav className={styles.nav}><Link href="/#bossbattle" className={styles.back}>← Back to Trashguy</Link><span>COMMUNITY BOSS BATTLE</span></nav>}
  <header className={styles.intro}><span className={styles.eyebrow}>FIVE BOSSES. ONE COMMUNITY.</span><h1>Community Boss Battle</h1><p>Three bosses to break-even. Two more to conquer the profit zone.</p></header>
  <div className={styles.sourceBar}>{process.env.NEXT_PUBLIC_LOCAL_REVIEW === "1" && <div className={styles.viewTabs}><button aria-pressed={source === 'test'} onClick={() => changeSource('test')}>Local test hunt</button><button aria-pressed={source === 'active'} onClick={() => changeSource('active')}>Active site hunt</button></div>}<a href={`/boss-battle/overlay?source=${source}`} target="_blank" rel="noreferrer">Open OBS overlay ↗</a></div>
  {error && <p role="alert" className={styles.error}>{error}</p>}
  {hunt && state && <div className={styles.bossTrail}>{BOSSES.map((boss, index) => <div key={boss.name} className={`${styles.bossStep} ${index < state.cleared ? styles.bossCleared : index === state.index ? styles.bossCurrent : ''}`}><div className={styles.bossPortrait}><TrashBoss miniature hit={false} defeated={false} variant={index} name={boss.name}/>{index < state.cleared && <i>✓</i>}</div><strong>{boss.name}</strong><small>{money(state.goals[index])}{index === 2 ? ' · Break-even' : index > 2 ? ' · Profit' : ''}</small></div>)}</div>}
  <div className={styles.layout}>{arena}<aside className={styles.side}><section className={styles.panel}><span className={styles.eyebrow}>HUNT PROGRESS</span><h3>{hunt?.title || 'No active hunt'}</h3><div className={styles.metrics}><div><small>Starting bankroll</small><strong>{money(hunt?.startCost || 0)}</strong></div><div><small>Returned</small><strong>{money(state?.total || 0)}</strong></div><div><small>Opened</small><strong>{state?.opened.length || 0} / {hunt?.bonuses.length || 0}</strong></div></div></section>
  <section className={styles.panel}><span className={styles.eyebrow}>COMMUNITY DAMAGE</span>{state?.leaders.length ? state.leaders.map(([name, value], index) => <div className={styles.contributors} key={name}><span>{index + 1}. {name}</span><strong>{money(value)}</strong></div>) : <p>Caller contributions appear as bonuses open.</p>}</section>
  <section className={styles.panel}><span className={styles.eyebrow}>BOSS FINISHERS</span>{BOSSES.map((boss, index) => <div className={styles.finisher} key={boss.name}><span>{boss.icon} {boss.name}</span><strong>{state?.kills[index]?.username || '—'}</strong></div>)}</section></aside></div>
  {process.env.NEXT_PUBLIC_LOCAL_REVIEW === "1" && source === 'test' && hunt && <section className={styles.testPanel}><div className={styles.testHeading}><div><span className={styles.eyebrow}>LOCAL OPENING DESK</span><h2>Open the test bonuses</h2><p>These results are saved locally and shared with the overlay. No live hunt is changed.</p></div><button disabled={saving || hunt.bonuses.every(b => b.payout !== null)} onClick={() => {
                const next = nextBonus(hunt);
                if (next) {
                    setOpening(true);
                    choose(next);
                }
            }}>Start opening</button></div>
  <div className={styles.testRows}>{hunt.bonuses.map(b => <div key={b.id}><strong>{b.slotName}<small>{b.username} · Bet {money(b.betSize)}</small></strong><span>{b.payout === null ? 'Unopened' : `${money(b.payout)} · ${(b.payout / b.betSize).toFixed(2)}×`}</span><button disabled={saving} onClick={() => { setOpening(false); choose(b); }}>{b.payout === null ? 'Enter payout' : 'Edit payout'}</button></div>)}</div>
  <form className={styles.resetRow} onSubmit={async (e) => {
                e.preventDefault();
                const next = await save({ action: 'reset', start });
                if (next) {
                    setSkipped([]);
                    setEntry(null);
                    setOpening(false);
                }
            }}><label>Starting bankroll<input aria-label="Starting bankroll" type="number" min="1" step="0.01" value={start} onChange={e => setStart(e.target.value)}/></label><button disabled={saving}>Reset local test</button></form>
  </section>}
  <details className={styles.bossGuide}><summary>Meet the five bosses <span>Designs & milestones</span></summary><div className={styles.bossGallery}>{BOSSES.map((boss, index) => <article key={boss.name}><TrashBoss hit={false} defeated={false} miniature variant={index} name={boss.name}/><strong>{boss.name}</strong><small>{boss.title}</small><p>{['First third of the bankroll', 'Two thirds of the bankroll', '100% returned · Break-even', '150% returned · 50% profit', '200% returned · 100% profit'][index]}</p></article>)}</div></details>
  {source === 'active' && <p className={styles.note}>This view follows the selected hunt and saved payouts from your existing Bonus Hunt Tracker. Enter results there; this page and its overlay refresh automatically.</p>}
  <p className={styles.note}>OBS browser source: 435 × 285. Third boss: 100% returned. Fourth: 150%. Final: 200%. Payout edits recalculate progress.</p>
  {entry && <div className={styles.modalBackdrop}><section className={styles.modal} ref={dialogRef} onKeyDown={e => {
                if (e.key === "Escape" && !saving) {
                    setEntry(null);
                    setOpening(false);
                }
                if (e.key === "Tab") {
                    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input,button:not(:disabled)') || []);
                    const first = controls[0], last = controls.at(-1);
                    if (e.shiftKey && document.activeElement === first) {
                        e.preventDefault();
                        last?.focus();
                    }
                    else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault();
                        first?.focus();
                    }
                }
            }} role="dialog" aria-modal="true" aria-labelledby="payout-title"><span className={styles.eyebrow}>{opening ? 'OPENING BONUS' : 'EDIT RESULT'}</span><h2 id="payout-title">{entry.slotName}</h2><p>{entry.username} · Bet {money(entry.betSize)}</p><form onSubmit={e => { e.preventDefault(); void confirm(); }}><label>Winnings<input autoFocus required aria-label="Winnings" type="number" min="0" step="0.01" value={payout} onChange={e => setPayout(e.target.value)}/></label>{error && <p role="alert">{error}</p>}<button disabled={saving}>{saving ? 'Saving…' : 'Confirm payout'}</button></form><div className={styles.modalActions}>{opening && <button disabled={saving} onClick={() => {
                    const skip = [...skipped, entry.id];
                    setSkipped(skip);
                    const next = nextBonus(hunt!, skip);
                    if (next)
                        choose(next);
                }}>Skip — return at end</button>}<button disabled={saving} onClick={() => { setEntry(null); setOpening(false); }}>Close</button></div></section></div>}
 </section>;
}
