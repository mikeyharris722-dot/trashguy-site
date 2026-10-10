export type StatsEntry = {
    id: string;
    username: string;
    slot_name: string;
    identifier?: string;
    provider?: string;
    artwork_url?: string | null;
    status: string;
    bet_size: string | number;
    payout: string | number | null;
    created_at?: string;
    updated_at?: string;
};
export type StatsHunt = {
    id: string;
    title: string;
    source?: string;
    casino?: string;
    phase: string;
    createdAt?: string;
    updatedAt?: string;
    startCost: number;
    entries: StatsEntry[];
};
export type RecordedCall = StatsEntry & {
    huntId: string;
    huntTitle: string;
    casino: string;
    date: string;
    payoutDate: string;
    multiplier: number | null;
    amount: number | null;
};
export const viewerKey = (value: string) => value.trim().replace(/^@/, '').toLowerCase();
export function monthKey(date: string) { const d = new Date(date); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).format(d); }
export function recordedCalls(hunts: StatsHunt[]): RecordedCall[] {
    const seen = new Set<string>();
    const rows: RecordedCall[] = [];
    for (const h of hunts)
        for (const e of h.entries || []) {
            if (seen.has(h.id + ':' + e.id) || !['collected', 'failed'].includes(e.status))
                continue;
            seen.add(h.id + ':' + e.id);
            const amount = e.status === 'collected' && e.payout !== null && e.payout !== '' && Number.isFinite(Number(e.payout)) ? Number(e.payout) : null;
            const bet = Number(e.bet_size);
            rows.push({ ...e, huntId: h.id, huntTitle: h.title, casino: h.casino || 'Unknown', date: e.created_at || h.createdAt || '', payoutDate: e.updated_at || (h.phase === "finished" ? h.updatedAt : undefined) || e.created_at || h.createdAt || '', amount, multiplier: amount !== null && bet > 0 ? amount / bet : null });
        }
    return rows.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}
export function summarizeCalls(rows: RecordedCall[]) {
    const collected = rows.filter(r => r.status === 'collected'), opened = collected.filter(r => r.amount !== null);
    const multipliers = opened.filter(r => r.multiplier !== null);
    return { calls: rows.length, collected: collected.length, failed: rows.filter(r => r.status === 'failed').length, opened: opened.length, pending: collected.length - opened.length, collectionRate: rows.length ? collected.length / rows.length * 100 : null, total: opened.reduce((n, r) => n + (r.amount || 0), 0), average: multipliers.length ? multipliers.reduce((n, r) => n + (r.multiplier || 0), 0) / multipliers.length : null, best: multipliers.reduce<RecordedCall | null>((best, r) => !best || r.multiplier! > best.multiplier! ? r : best, null) };
}
export const slotKey = (r: RecordedCall) => r.identifier || (r.provider || '') + ':' + r.slot_name.toLowerCase();
export function groupCalls(rows: RecordedCall[], by: 'viewer' | 'slot') {
    const groups = new Map<string, {
        name: string;
        detail: string;
        rows: RecordedCall[];
    }>();
    for (const r of rows) {
        const name = by === 'viewer' ? r.username : r.slot_name;
        if (!name?.trim())
            continue;
        const key = by === 'viewer' ? viewerKey(name) : slotKey(r);
        const g = groups.get(key) || { name, detail: by === 'slot' ? r.provider || r.casino : '', rows: [] };
        g.rows.push(r);
        groups.set(key, g);
    }
    return [...groups.entries()].map(([key, g]) => ({ key, name: g.name, detail: g.detail, artwork:g.rows.find(r=>r.artwork_url)?.artwork_url || '', ...summarizeCalls(g.rows) })).sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));
}
export type ParticipationHunt = {
    id: string;
    title?: string;
    phase: string;
    members: {
        name: string;
        status: string;
        amount?: string | number | null;
    }[];
};
export function londonWeek(date: string) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime()))
        return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const get = (key: string) => Number(parts.find(p => p.type === key)?.value);
    const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return day.toISOString().slice(0, 10);
}
export function achievementBadges(name: string, hunts: ParticipationHunt[], rows: RecordedCall[], now: string) {
    const key = viewerKey(name);
    const count = new Set(hunts.filter(h => h.phase === 'finished' && h.members.some(m => m.status === 'accepted' && viewerKey(m.name) === key)).map(h => h.id)).size;
    const tiers = [{ at: 1, name: 'Community newcomer', icon: '👻' }, { at: 3, name: 'Community regular', icon: '🎃' }, { at: 5, name: 'Community devoted', icon: '✨' }, { at: 10, name: 'Community veteran', icon: '💜' }, { at: 25, name: 'Community legend', icon: '👑' }];
    const tier = [...tiers].reverse().find(t => count >= t.at), next = tiers.find(t => count < t.at);
    const opened = rows.filter(r => r.amount !== null && r.amount > 0 && r.username?.trim());
    const highest = (list: RecordedCall[]) => list.reduce((n, r) => Math.max(n, r.amount || 0), 0);
    const week = opened.filter(r => londonWeek(r.payoutDate) === londonWeek(now)), weekMax = highest(week), allMax = highest(opened);
    const wins = (list: RecordedCall[], max: number) => max > 0 && list.some(r => viewerKey(r.username) === key && r.amount === max);
    return [{ id: 'community', icon: tier?.icon || '👻', name: tier?.name || 'Community participant', description: count + ' completed Community Hunt' + (count === 1 ? '' : 's'), earned: count > 0, progress: next ? 'Next level at ' + next.at + (next.at === 1 ? ' hunt' : ' hunts') : 'Highest level reached' }, { id: 'weekly-call', icon: '🏆', name: 'Top call this week', description: 'Highest recorded payout this week · ties share the award', earned: wins(week, weekMax), progress: weekMax ? 'Leading payout: $' + weekMax.toFixed(2) : 'No payouts recorded this week' }, { id: 'all-time-call', icon: '⭐', name: 'All-time top call', description: 'Highest payout across recorded site hunts · ties share the award', earned: wins(opened, allMax), progress: allMax ? 'Leading payout: $' + allMax.toFixed(2) : 'No payouts recorded yet' }];
}

export type StatsSort = 'calls'|'collected'|'collectionRate'|'average'|'best';
export function sortStatGroups<T extends {name:string;calls:number;collected:number;collectionRate:number|null;average:number|null;best:{multiplier:number|null}|null}>(rows:T[],metric:StatsSort,direction:'asc'|'desc') {
 const value=(r:T)=>metric==='best'?r.best?.multiplier??null:r[metric];
 return [...rows].sort((a,b)=>{const av=value(a),bv=value(b);if(av===null)return bv===null?a.name.localeCompare(b.name):1;if(bv===null)return -1;return (direction==='asc'?av-bv:bv-av)||a.name.localeCompare(b.name)});
}
