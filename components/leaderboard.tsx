"use client";
import type { PrizeSettings } from "@/lib/prize-settings";
import { prizeTotal } from "@/lib/prize-settings";
type Player = {
  rank: number;
  username: string;
  wagered: number;
  totalWagered: number;
};
const money = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
export default function Leaderboard({
  players,
  settings,
  loading,
  error,
  countdown,
  retry,
}: {
  players: Player[];
  settings: PrizeSettings;
  loading: boolean;
  error: string;
  countdown: string;
  retry: () => void;
}) {
  return (
    <div className="leaderboard-layout">
      <header className="workspace-panel leaderboard-intro">
        <div>
          <p className="eyebrow">Roulo community leaderboard</p>
          <h1>{money(prizeTotal(settings))} prize pool</h1>
          <p className="competition-period">
            {settings.leaderboardStart} to {settings.leaderboardEnd} · Ends at
            00:00 UTC
          </p>
          <p>
            Places are ranked by weighted wager. Total wager is shown separately
            and does not decide your rank.
          </p>
        </div>
        <div className="deadline-chip">
          <span>Time remaining</span>
          <strong>{countdown}</strong>
        </div>
      </header>
      {error && (
        <div className="form-error" role="alert">
          {error}{" "}
          <button onClick={retry} type="button">
            Refresh leaderboard
          </button>
        </div>
      )}
      {loading && !players.length ? (
        <p className="empty-state" role="status">
          Loading the latest leaderboard…
        </p>
      ) : !players.length ? (
        <div className="empty-state">
          <h2>No leaderboard entries available</h2>
          <p>
            Players will appear here when the provider supplies the current
            leaderboard.
          </p>
        </div>
      ) : (
        <>
          <div className="leaderboard-podium">
            {players.slice(0, 3).map((player) => (
              <article
                className={`podium-place podium-${player.rank}`}
                key={player.username}
              >
                <span className="podium-rank">#{player.rank}</span>
                <div>
                  <h2 title={player.username}>{player.username}</h2>
                  <p>
                    Weighted wager <strong>{money(player.wagered)}</strong>
                  </p>
                </div>
                <strong className="podium-prize">
                  {settings.leaderboard[player.rank - 1] > 0
                    ? money(settings.leaderboard[player.rank - 1])
                    : "No cash prize"}
                </strong>
              </article>
            ))}
          </div>
          <div className="workspace-panel leaderboard-table">
            <table>
              <caption>Current standings · top ten players</caption>
              <thead>
                <tr>
                  <th scope="col">Place</th>
                  <th scope="col">Player</th>
                  <th scope="col">Weighted wager</th>
                  <th scope="col" className="leaderboard-total">
                    Total wager
                  </th>
                  <th scope="col">Prize</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr
                    key={player.username}
                    className={player.rank <= 3 ? "leaderboard-leading" : ""}
                  >
                    <td>
                      <span className="table-rank">{player.rank}</span>
                    </td>
                    <th scope="row">
                      <span title={player.username}>{player.username}</span>
                      <small className="mobile-wager">
                        Total: {money(player.totalWagered)}
                      </small>
                    </th>
                    <td>{money(player.wagered)}</td>
                    <td className="leaderboard-total">
                      {money(player.totalWagered)}
                    </td>
                    <td className="table-prize">
                      {settings.leaderboard[player.rank - 1] > 0
                        ? money(settings.leaderboard[player.rank - 1])
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
