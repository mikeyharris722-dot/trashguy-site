"use client";
import { useEffect, useState } from "react";
import "./overlay.css";
type Bonus = {
  id: string;
  slotName: string;
  betSize: number;
  payout: number | null;
  multiplier: number;
  tier: string;
};
type Hunt = {
  id: string;
  title: string;
  phase: string;
  startCost: number;
  latest: Bonus | null;
  currentId: string | null;
  bonuses: Bonus[];
  stats: {
    bonusCount: number;
    unopenedBonuses: number;
    totalWinnings: number;
    currentAverageMultiplier: number;
    averagePayoutRequired: number | null;
    profitLoss: number;
  };
};
const cash = (n: number) =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export default function Overlay() {
  const [hunt, setHunt] = useState<Hunt | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const abort = new AbortController();
    async function load() {
      try {
        const r = await fetch(
          new URLSearchParams(window.location.search).get("community") === "1"
            ? "/api/community/overlay"
            : "/api/overlay",
          {
            cache: "no-store",
            signal: abort.signal,
          },
        );
        if (!r.ok) throw Error();
        const d = await r.json();
        if (live) {
          setHunt(d.hunt);
          setError(false);
        }
      } catch {
        if (live) setError(true);
      }
    }
    void load();
    const t = setInterval(load, 2000);
    return () => {
      live = false;
      abort.abort();
      clearInterval(t);
    };
  }, []);
  if (!hunt)
    return (
      <main className="hunt-overlay">
        <header>Bonus Hunt</header>
        <p className="overlay-empty">
          {error
            ? "Tracker temporarily unavailable"
            : "Select an active hunt in the admin hub"}
        </p>
      </main>
    );
  const opened = hunt.bonuses.filter((b) => b.payout !== null),
    best = [...opened].sort((a, b) => b.multiplier - a.multiplier)[0],
    biggest = [...opened].sort((a, b) => (b.payout || 0) - (a.payout || 0))[0];
  const scrolling = hunt.phase === "collecting" && hunt.bonuses.length > 6;
  const visible =
    hunt.phase === "opening"
      ? hunt.bonuses.filter((b) => b.payout === null)
      : hunt.bonuses;
  const row = (b: Bonus, index: number, copy = false) => (
    <div
      className={
        "overlay-row " + (b.id === hunt.currentId ? "overlay-current" : "")
      }
      key={(copy ? "copy" : "") + b.id}
    >
      <span className="overlay-slot">
        #{index + 1} &nbsp;{b.slotName}
        {b.tier !== "standard" && <em>{b.tier.replaceAll("_", " ")}</em>}
      </span>
      <span>{cash(b.betSize)}</span>
      <span>{b.payout === null ? "—" : cash(b.payout)}</span>
    </div>
  );
  return (
    <main className="hunt-overlay" aria-label="Bonus hunt stream overlay">
      <header>
        <strong>{hunt.title}</strong>
        <span>
          {hunt.phase === "collecting"
            ? "COLLECTING"
            : hunt.phase === "opening"
              ? "OPENING"
              : "FINISHED"}
        </span>
      </header>
      <section className="overlay-stats">
        <label>
          Start: <b>{cash(hunt.startCost)}</b>
        </label>
        <label>
          Winnings: <b>{cash(hunt.stats.totalWinnings)}</b>
        </label>
        <label>
          Total Bonuses: <b>{hunt.stats.bonusCount}</b>
        </label>
        <label>
          Remaining: <b>{hunt.stats.unopenedBonuses}</b>
        </label>
        <label>
          Run Average: <b>{hunt.stats.currentAverageMultiplier.toFixed(2)}×</b>
        </label>
        <label>
          Req Average:{" "}
          <b>{hunt.stats.averagePayoutRequired?.toFixed(2) ?? "—"}×</b>
        </label>
      </section>
      <section className="overlay-awards">
        <div>
          <span>★ Best multiplier</span>
          <b>{best ? best.slotName : "Waiting for opening"}</b>
          <small>{best ? best.multiplier.toFixed(2) + "×" : "—"}</small>
        </div>
        <div>
          <span>◆ Biggest win</span>
          <b>{biggest ? biggest.slotName : "Waiting for opening"}</b>
          <small>{biggest ? cash(biggest.payout || 0) : "—"}</small>
        </div>
      </section>
      {hunt.phase === "opening" && hunt.latest && (
        <section className="overlay-latest">
          <span>LATEST RESULT</span>
          <b>{hunt.latest.slotName}</b>
          <strong>
            {cash(hunt.latest.payout || 0)}{" "}
            <small>({hunt.latest.multiplier.toFixed(2)}×)</small>
          </strong>
        </section>
      )}
      <section className="overlay-table">
        <div className="overlay-columns">
          <span>{hunt.phase === "opening" ? "Next to open" : "Slot"}</span>
          <span>Bet</span>
          <span>Payout</span>
        </div>
        <div
          className={
            "overlay-list " + (scrolling ? "overlay-scroll" : "overlay-static")
          }
        >
          <div
            className="overlay-track"
            style={{
              animationDuration: Math.max(18, visible.length * 3) + "s",
            }}
          >
            {visible.map((b, i) => row(b, i))}
            {scrolling && (
              <div aria-hidden="true">
                {visible.map((b, i) => row(b, i, true))}
              </div>
            )}
          </div>
        </div>
        {!visible.length && (
          <p className="overlay-empty">
            {hunt.phase === "opening"
              ? "All bonuses opened"
              : "Waiting for bonuses"}
          </p>
        )}
      </section>
      {error && (
        <small className="overlay-warning">
          Reconnecting · showing last update
        </small>
      )}
    </main>
  );
}
