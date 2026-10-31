"use client";
import { useState } from "react";
import { siteFetch } from "@/lib/site-fetch";
import type { PrizeSettings } from "@/lib/prize-settings";
export default function PublicSectionVisibility({
  section,
  enabled,
  loaded,
  saved,
}: {
  section: "tournaments" | "community";
  enabled: boolean;
  loaded: boolean;
  saved: (settings: PrizeSettings) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const label = section === "community" ? "Community Hunts" : "Tournaments";
  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await siteFetch("/api/admin/navigation-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          enabled: !enabled,
          requestId: crypto.randomUUID(),
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Could not change visibility.");
      saved(data.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change visibility.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-white/50">
        Public menu: {loaded ? (enabled ? "visible" : "hidden") : "loading…"}
      </span>
      <button
        type="button"
        disabled={!loaded || busy}
        onClick={() => void toggle()}
        className="rounded-lg border border-purple-300/25 bg-purple-500/15 px-3 py-2 text-xs font-bold text-purple-100 transition hover:bg-purple-500/25 disabled:opacity-40"
      >
        {busy ? "Saving…" : `${enabled ? "Hide" : "Show"} ${label}`}
      </button>
      {error && (
        <span role="alert" className="text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
