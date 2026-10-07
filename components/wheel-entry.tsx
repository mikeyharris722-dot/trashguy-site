"use client";
import { useState } from "react";
import SlotSearch, { type SlotOption } from "./slot-search";
export type WheelCall = {
  id: string;
  username: string;
  slotName: string;
  createdAt: number;
  needsReview?: boolean;
  originalRequest?: string;
  suggestions?: SlotOption[];
};
export default function WheelEntry({
  call,
  bet,
  onBet,
  busy,
  huntId,
  onClose,
  onResolve,
  onRecord,
}: {
  call: WheelCall;
  bet: string;
  onBet: (s: string) => void;
  busy: boolean;
  huntId: string;
  onClose: () => void;
  onResolve: (game: SlotOption) => Promise<void>;
  onRecord: (status: "collected" | "failed") => void;
}) {
  const [selected, setSelected] = useState<SlotOption | null>(null),
    [error, setError] = useState("");
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-entry-title"
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-purple-300/30 bg-[#100817] p-6 shadow-[0_0_70px_rgba(168,85,247,0.2)]"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const items = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled)",
              ),
            );
            if (e.shiftKey && document.activeElement === items[0]) {
              e.preventDefault();
              items.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
              e.preventDefault();
              items[0]?.focus();
            }
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-purple-300">
              Slot call winner
            </p>
            <h2
              id="slot-entry-title"
              className="mt-2 text-2xl font-black text-white"
            >
              {call.slotName}
            </h2>
            <p className="mt-1 text-sm text-white/50">{call.username}</p>
          </div>
          <button
            autoFocus
            aria-label="Close result entry"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-white/15 px-3 py-2 text-white"
          >
            ✕
          </button>
        </div>
        {call.needsReview ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-amber-200">
              Confirm the slot before recording the result. Original call: “
              {call.originalRequest || call.slotName}”
            </p>
            <SlotSearch
              label="Find correct slot"
              initialQuery={call.originalRequest || call.slotName}
              suggestions={call.suggestions}
              selected={selected}
              onSelect={setSelected}
            />
            <button
              disabled={busy || !selected}
              className="w-full rounded-xl bg-purple-500/30 px-4 py-3 font-bold text-purple-100 disabled:opacity-40"
              onClick={async () => {
                if (!selected) return;
                try {
                  await onResolve(selected);
                  setError("");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Could not confirm slot",
                  );
                }
              }}
            >
              Confirm slot
            </button>
          </div>
        ) : (
          <>
            <label className="mt-6 block text-sm text-white/70">
              Bet size
              <input
                aria-label="Selected call bet size"
                className="mt-2 w-full rounded-xl border border-purple-300/20 bg-black p-3 text-xl text-white"
                value={bet}
                onChange={(e) => onBet(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                disabled={
                  busy ||
                  !huntId ||
                  !/^\d+(?:\.\d{1,6})?$/.test(bet) ||
                  Number(bet) <= 0
                }
                className="rounded-xl bg-emerald-500/20 p-3 text-sm font-black text-emerald-200 disabled:opacity-40"
                onClick={() => onRecord("collected")}
              >
                GOT IN
              </button>
              <button
                disabled={
                  busy ||
                  !huntId ||
                  !/^\d+(?:\.\d{1,6})?$/.test(bet) ||
                  Number(bet) <= 0
                }
                className="rounded-xl bg-red-500/20 p-3 text-sm font-black text-red-200 disabled:opacity-40"
                onClick={() => onRecord("failed")}
              >
                DIDN’T GET IN
              </button>
            </div>
            <p className="mt-3 text-xs text-white/45">
              {huntId
                ? "Saves the result and removes this call from the wheel."
                : "Choose a hunt in the controls below the wheel first."}
            </p>
          </>
        )}
        {error && (
          <p role="status" className="mt-2 text-sm text-red-300">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
