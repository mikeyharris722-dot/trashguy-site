import "server-only";
import { providerRows } from "./leaderboard-provider";
import { serverPrizeSettings } from "./server-prize-settings";
const login = (value: unknown) => String(value || '').replace(/^@/, '').trim().toLowerCase();
function player(rows: Record<string, unknown>[], username: string) {
  return rows.find(p => login(p.username || p.affiliate_username || p.name || p.display_name || p.user_name || p.player_name || (p.user as {username?:string})?.username) === login(username));
}
function amount(row: Record<string, unknown> | undefined, weighted = false) {
  if (!row) return 0; // A successful complete list can legitimately contain no activity.
  const value = weighted
    ? row.weighted_wagered_amount ?? row.weightedWageredAmount ?? row.weighted_wagered
    : row.wagered_amount ?? row.wageredAmount ?? row.total_wagered ?? row.totalWagered ?? row.wagered;
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)
    throw Error('The provider returned incomplete wager data.');
  return Number(value);
}
export async function profileWagerStats(username: string) {
  // Include the current UTC day; the provider accepts date-only range boundaries.
  const end = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [lifetime, current] = await Promise.allSettled([
    providerRows('2024-01-01', end, {weighted:false}).then(rows => {
      const match = player(rows, username);
      return {value:amount(match), found:!!match};
    }),
    (async () => {
      const settings = await serverPrizeSettings();
      // Same date range, weighted response and shared cache as the public leaderboard.
      const rows = await providerRows(settings.leaderboardStart, settings.leaderboardEnd);
      const match = player(rows, username);
      return {raw:amount(match), weighted:amount(match,true), found:!!match};
    })(),
  ]);
  return {
    rouloUsername:login(username),
    found:(lifetime.status === 'fulfilled' && lifetime.value.found) || (current.status === 'fulfilled' && current.value.found),
    lifetimeWagered:lifetime.status === 'fulfilled' ? lifetime.value.value : null,
    leaderboardWagered:current.status === 'fulfilled' ? current.value.raw : null,
    leaderboardWeightedWagered:current.status === 'fulfilled' ? current.value.weighted : null,
    warning:lifetime.status === 'rejected' || current.status === 'rejected'
      ? 'Wager refresh delayed. Unavailable figures will retry automatically.' : '',
  };
}
