"use client";
import { useEffect, useId, useRef, useState } from "react";
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
  const id = useId(),
    container = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(selected?.name || initialQuery),
    [results, setResults] = useState<SlotOption[]>(suggestions),
    [error, setError] = useState(""),
    [open, setOpen] = useState(!selected),
    [loading, setLoading] = useState(false),
    [active, setActive] = useState(0);
  useEffect(() => {
    if (!open || !query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(endpoint + "?q=" + encodeURIComponent(query), {
          signal: controller.signal,
          cache: "no-store",
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Search is unavailable. Try again.");
        setResults(d.games || []);
        setActive(0);
      } catch (e) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(e instanceof Error ? e.message : "Search is unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
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
  const show = open && !!query.trim(),
    select = (g: SlotOption) => {
      onSelect(g);
      setQuery(g.name);
      setOpen(false);
    };
  return (
    <div
      ref={container}
      className="slot-search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="search-input-wrap">
        <input
          id={id}
          ref={input}
          role="combobox"
          aria-label={label}
          aria-expanded={show}
          aria-controls={id + "-results"}
          aria-autocomplete="list"
          aria-activedescendant={
            show && !loading && unique[active]
              ? id + "-option-" + active
              : undefined
          }
          autoComplete="off"
          value={query}
          placeholder="Start typing a slot name…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            onSelect(null);
            setResults([]);
            setOpen(true);
            setLoading(!!e.target.value.trim());
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (show) {
                e.stopPropagation();
                setOpen(false);
              }
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, unique.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && show) {
              e.preventDefault();
              if (!loading && unique[active]) select(unique[active]);
            }
          }}
        />
        {query && (
          <button
            type="button"
            aria-label={"Clear " + label}
            onClick={() => {
              setQuery("");
              onSelect(null);
              setResults([]);
              setOpen(false);
              setLoading(false);
              input.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      {show && (
        <div
          className="search-results"
          id={id + "-results"}
          role="listbox"
          aria-label="Matching slots"
        >
          {loading ? (
            <p role="status">Searching for matching slots…</p>
          ) : unique.length ? (
            unique.map((g, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                tabIndex={-1}
                id={id + "-option-" + index}
                key={g.identifier}
                className={index === active ? "is-highlighted" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(g)}
              >
                {g.artwork_url ? (
                  <Image
                    unoptimized
                    src={g.artwork_url}
                    alt=""
                    width={44}
                    height={44}
                  />
                ) : (
                  <span aria-hidden="true" className="search-artwork-fallback">
                    ♠
                  </span>
                )}
                <span>
                  <b>{g.name}</b>
                  <small>{providerName(g.provider, g.producer)}</small>
                </span>
              </button>
            ))
          ) : (
            <p>
              {error ||
                "No matching slots found. Try fewer words or a different spelling."}
            </p>
          )}
        </div>
      )}
      {selected ? (
        <p className="search-selected" role="status">
          ✓ {selected.name} ·{" "}
          {providerName(selected.provider, selected.producer)}
        </p>
      ) : (
        <p className="search-hint">
          Choose a result to confirm the game. Use ↑ ↓ and Enter, or click a
          result.
        </p>
      )}
      {error && !show && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
