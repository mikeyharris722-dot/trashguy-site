export type BattleBonus = {
    id: string;
    slotName: string;
    username?: string;
    betSize: number;
    payout: number | null;
    openedAt?: string;
};
export type BattleHunt = {
    id: string;
    title: string;
    phase: string;
    startCost: number;
    bonuses: BattleBonus[];
    latest?: BattleBonus | null;
};
export const BOSSES = [
    { name: "Bin Bandit", title: "THE ALLEY MENACE", goal: 1 / 3, icon: "🗑️", hue: 0 },
    { name: "Sludge Snatcher", title: "THE TOXIC TERROR", goal: 2 / 3, icon: "☣️", hue: 45 },
    { name: "Binzilla", title: "THE BREAK-EVEN GUARDIAN", goal: 1, icon: "💀", hue: 0 },
    { name: "Dumpster Demon", title: "THE PROFIT DEVOURER", goal: 1.5, icon: "🔥", hue: 210 },
    { name: "Lord Landfill", title: "THE FINAL OVERLORD", goal: 2, icon: "👑", hue: 85 },
];
export function battleState(hunt: BattleHunt) {
    const rows = [...new Map(hunt.bonuses.map(b => [b.id, b])).values()];
    const opened = rows.filter(b => b.payout !== null && Number.isFinite(b.payout) && Number(b.payout) >= 0).sort((a, b) => (a.openedAt || "").localeCompare(b.openedAt || ""));
    const total = opened.reduce((sum, b) => sum + Math.round(Number(b.payout) * 100), 0) / 100;
    const valid = Number.isFinite(hunt.startCost) && hunt.startCost >= 0.03;
    const goals = BOSSES.map(b => Math.round(hunt.startCost * b.goal * 100) / 100);
    const cleared = valid ? goals.filter(goal => total >= goal).length : 0;
    const index = Math.min(cleared, 4), low = index ? goals[index - 1] : 0, goal = goals[index];
    const remaining = valid ? Math.max(0, goal - total) : 0;
    const hp = valid ? Math.max(0, Math.min(1000, Math.round(remaining / Math.max(0.01, goal - low) * 1000))) : 0;
    let cumulative = 0;
    const kills = goals.map(goal => {
        cumulative = 0;
        return opened.find(b => { cumulative += Math.round(Number(b.payout) * 100); return cumulative >= Math.round(goal * 100); }) || null;
    });
    const leaders = Object.entries(opened.reduce<Record<string, number>>((s, b) => { const name = b.username || "Host"; s[name] = (s[name] || 0) + Number(b.payout); return s; }, {})).sort((a, b) => b[1] - a[1]);
    return { valid, total, goals, cleared, index, boss: BOSSES[index], goal, low, remaining, hp, opened, leaders, kills, finished: cleared === 5, profit: total - hunt.startCost };
}
