"use client";
import { useEffect, useState } from "react";
type Entry = {
  id: string;
  slot_name: string;
  username: string;
  status: string;
  bet_size: string;
  payout: string | null;
  collection_cost: string;
};
export default function TrackerResults({ huntId }: { huntId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/site-tracker", {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load results");
        if (live) {
          setEntries(
            data.hunts?.find((h: { id: string }) => h.id === huntId)?.entries ||
              [],
          );
          setError("");
        }
      } catch (e) {
        if (live)
          setError(e instanceof Error ? e.message : "Could not load results");
      }
    };
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      live = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [huntId]);
  return (
    <section
      className="rounded-xl border border-purple-300/15 bg-black/70 p-4"
      aria-label="Hunt rolled results"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider text-purple-200">
          Rolled results
        </h3>
        <span className="text-xs text-white/50">{entries.length} results</span>
      </div>
      <p className="mt-1 text-xs text-white/40">
        {huntId
          ? "Current hunt · wheel and manual bonuses"
          : "Select a hunt in the controls below."}
      </p>
      <div className="mt-3 max-h-80 space-y-2 overflow-auto">
        {entries.map((e) => (
          <div
            key={e.id}
            className="rounded-lg border border-white/10 bg-white/[0.025] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{e.slot_name}</p>
                <p className="text-xs text-white/45">
                  {e.username} · Bet ${Number(e.bet_size).toFixed(2)} · Cost $
                  {Number(e.collection_cost).toFixed(2)}
                </p>
              </div>
              <span
                className={
                  "shrink-0 rounded px-2 py-1 text-[10px] font-bold " +
                  (e.status === "collected"
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-red-400/10 text-red-300")
                }
              >
                {e.status === "collected" ? "GOT IN" : "DIDN’T GET IN"}
              </span>
            </div>
            {e.status === "collected" && (
              <p className="mt-2 text-xs font-bold text-purple-200">
                {e.payout === null
                  ? "Awaiting opening"
                  : "Payout $" + Number(e.payout).toFixed(2)}
              </p>
            )}
          </div>
        ))}
        {huntId && !entries.length && (
          <p className="py-6 text-center text-sm text-white/40">
            No results recorded for this hunt yet.
          </p>
        )}
      </div>
      {error && (
        <p role="status" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
