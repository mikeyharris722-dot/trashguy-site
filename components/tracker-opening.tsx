"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Entry } from "./tracker-admin";

export default function OpeningSession({
  entries,
  huntId,
  initialQueue,
  busy,
  onClose,
  save,
}: {
  entries: Entry[];
  huntId: string;
  initialQueue: string[];
  busy: boolean;
  onClose: () => void;
  save: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [queue, setQueue] = useState(() => {
    const ids = entries
      .filter((e) => e.status === "collected" && e.payout === null)
      .map((e) => e.id);
    return [
      ...initialQueue.filter((id) => ids.includes(id)),
      ...ids.filter((id) => !initialQueue.includes(id)),
    ];
  });
  const [saved, setSaved] = useState<string[]>([]);
  const [payout, setPayout] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pending = queue.filter(
    (id) =>
      !saved.includes(id) &&
      entries.some(
        (e) => e.id === id && e.status === "collected" && e.payout === null,
      ),
  );
  const queueKey = pending.join(",");
  useEffect(() => {
    const abort = new AbortController();
    async function sync() {
      try {
        const { data } = await supabaseBrowser.auth.getSession();
        if (abort.signal.aborted) return;
        const r = await fetch("/api/admin/site-tracker", {
          method: "POST",
          signal: abort.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + (data.session?.access_token || ""),
          },
          body: JSON.stringify({
            action: "openingFocus",
            huntId,
            entryIds: queueKey ? queueKey.split(",") : [],
          }),
        });
        if (!r.ok && !abort.signal.aborted)
          setError(
            "Overlay order could not sync. Close and resume opening to retry.",
          );
      } catch {
        if (!abort.signal.aborted)
          setError(
            "Overlay connection interrupted. Close and resume to retry.",
          );
      }
    }
    void sync();
    return () => abort.abort();
  }, [huntId, queueKey]);
  const entry = entries.find((e) => e.id === pending[0]);
  useEffect(() => {
    input.current?.focus();
  }, [entry?.id]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="opening-title"
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-purple-300/30 bg-[#100817] p-6 text-white shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const nodes = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled)",
              ),
            );
            if (e.shiftKey && document.activeElement === nodes[0]) {
              e.preventDefault();
              nodes.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
              e.preventDefault();
              nodes[0]?.focus();
            }
          }
        }}
      >
        <div className="flex justify-between gap-3">
          <h2 id="opening-title" className="text-xl font-black">
            Opening bonuses
          </h2>
          <button disabled={busy} aria-label="Close opening" onClick={onClose}>
            ✕
          </button>
        </div>
        {entry ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || !payout.trim()) return;
              setError("");
              if (
                await save({
                  action: "payout",
                  entryId: entry.id,
                  payout,
                  bet: entry.bet_size,
                  cost: entry.collection_cost,
                })
              ) {
                setSaved((ids) => [...ids, entry.id]);
                setPayout("");
              } else
                setError(
                  "Could not save winnings. Your entry is still here; close the popup to see the detailed error, or retry.",
                );
            }}
            className="mt-5 space-y-4"
          >
            <p className="text-xs text-white/50">
              {pending.length} remaining · skipped bonuses return at the end
            </p>
            <div className="flex items-center gap-4">
              {entry.artwork_url && (
                <Image
                  unoptimized
                  src={entry.artwork_url}
                  width={80}
                  height={80}
                  alt=""
                  className="rounded-xl"
                />
              )}
              <div>
                <h3 className="text-2xl font-black">{entry.slot_name}</h3>
                <p className="text-white/60">
                  Bet ${Number(entry.bet_size).toFixed(2)} · {entry.username}
                </p>
                <p className="font-black uppercase text-amber-300">
                  {entry.bonus_tier.replaceAll("_", " ")}
                </p>
              </div>
            </div>
            {entry.notes && (
              <p className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-3 text-cyan-200">
                ✎ {entry.notes}
              </p>
            )}
            <label className="block text-sm">
              Winnings
              <input
                ref={input}
                aria-label="Bonus winnings"
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                required
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
                disabled={busy}
                className="mt-2 w-full rounded-lg border border-purple-300/30 bg-black p-3 text-xl"
                placeholder="0.00"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy || !payout.trim()}
                className="flex-1 rounded-lg bg-purple-500 px-4 py-3 font-bold disabled:opacity-40"
              >
                Confirm and next
              </button>
              <button
                type="button"
                disabled={busy || pending.length < 2}
                className="rounded-lg border border-white/20 px-4 py-3 disabled:opacity-40"
                onClick={() => {
                  setQueue((ids) => [
                    ...ids.filter((id) => id !== entry.id),
                    entry.id,
                  ]);
                  setPayout("");
                }}
              >
                Skip for now
              </button>
            </div>
            {pending.length === 1 && (
              <p className="text-xs text-white/50">
                Last pending bonus. Close to leave it for later.
              </p>
            )}
          </form>
        ) : (
          <div className="mt-6">
            <p>All pending bonuses have been recorded.</p>
            <button
              autoFocus
              onClick={onClose}
              className="mt-4 rounded-lg bg-purple-500 px-4 py-2"
            >
              Done
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
