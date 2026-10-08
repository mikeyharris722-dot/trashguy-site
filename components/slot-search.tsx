"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { providerName } from "@/lib/slot-providers";
export type SlotOption = {
  identifier: string;
  name: string;
  provider: string;
  producer?: string;
  artwork_url?: string | null;
  enabled?: boolean;
};
export default function SlotSearch({
  selected,
  onSelect,
  label = "Find slot to add",
  initialQuery = "",
  suggestions = [],
  endpoint = "/api/catalogue",
}: {
  selected: SlotOption | null;
  onSelect: (game: SlotOption | null) => void;
  label?: string;
  initialQuery?: string;
  suggestions?: SlotOption[];
  endpoint?: string;
}) {
  const [query, setQuery] = useState(initialQuery),
    [results, setResults] = useState<SlotOption[]>(suggestions),
    [error, setError] = useState(""),
    [open, setOpen] = useState(!selected);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(endpoint + "?q=" + encodeURIComponent(query), {
          signal: controller.signal,
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Search unavailable");
        setResults(d.games || []);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Search unavailable");
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, endpoint]);
  const unique = [
    ...new Map(
      results
        .filter((g) => g.enabled !== false)
        .map((g) => [
          g.name.toLowerCase() + "|" + providerName(g.provider, g.producer),
          g,
        ]),
    ).values(),
  ].slice(0, 8);
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-white/60">
        {label}
        <input
          aria-label={label}
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-purple-300/20 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-purple-300/60"
          value={query}
          placeholder="Start typing a slot name…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onSelect(null);
            setOpen(true);
          }}
        />
      </label>
      {open && query.trim() && (
        <div className="max-h-64 space-y-1 overflow-auto rounded-xl border border-white/10 bg-black/75 p-1">
          {unique.map((g) => (
            <button
              type="button"
              key={g.identifier}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-purple-400/15 focus:bg-purple-400/15"
              onClick={() => {
                onSelect(g);
                setQuery(g.name);
                setOpen(false);
              }}
            >
              {g.artwork_url && (
                <Image
                  unoptimized
                  width={40}
                  height={40}
                  src={g.artwork_url}
                  alt=""
                  className="h-10 w-10 rounded object-cover"
                />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white">
                  {g.name}
                </span>
                <span className="block text-xs text-white/45">
                  {providerName(g.provider, g.producer)}
                </span>
              </span>
            </button>
          ))}
          {!unique.length && (
            <p className="p-3 text-xs text-white/50">
              No close matches. Try another name.
            </p>
          )}
        </div>
      )}
      {selected && (
        <p className="text-xs text-emerald-300">
          Selected: {selected.name} ·{" "}
          {providerName(selected.provider, selected.producer)}
        </p>
      )}
      {error && (
        <p role="status" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
