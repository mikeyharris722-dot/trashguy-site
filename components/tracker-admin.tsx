"use client";
import { useEffect, useRef, useState } from "react";
import { providerName } from "@/lib/slot-providers";
import { supabaseBrowser } from "@/lib/supabase/client";
type Game = {
  identifier: string;
  name: string;
  provider: string;
  producer?: string;
  artwork_url?: string | null;
  aliases?: string[];
  enabled?: boolean;
};
type Entry = {
  id: string;
  call_id: string;
  slot_name: string;
  username: string;
  status: string;
  bet_size: string;
  payout: string | null;
  collection_cost: string;
};
type Hunt = {
  id: string;
  title: string;
  phase: string;
  startCost: number;
  entries: Entry[];
  stats: {
    totalWinnings: number;
    profitLoss: number;
    averagePayoutRequired: number | null;
    currentAverageMultiplier: number;
  };
};
export default function TrackerAdmin({
  huntId,
  onHunt,
  onChange,
  manual = false,
}: {
  huntId: string;
  onHunt: (id: string) => void;
  onChange: () => void;
  manual?: boolean;
}) {
  const [hunts, setHunts] = useState<Hunt[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [title, setTitle] = useState(""),
    [start, setStart] = useState(""),
    [query, setQuery] = useState(""),
    [games, setGames] = useState<Game[]>([]),
    [review, setReview] = useState<
      { id: string; username: string; slot_name: string }[]
    >([]),
    [choice, setChoice] = useState(""),
    [aliases, setAliases] = useState(""),
    [correctedName, setCorrectedName] = useState(""),
    [imageUrl, setImageUrl] = useState("");
  async function load() {
    const [h, c] = await Promise.all([
      fetch("/api/site-tracker").then((r) => r.json()),
      fetch("/api/slot-calls").then((r) => r.json()),
    ]);
    setHunts(h.hunts || []);
    setReview([...(c.reviewCalls || []), ...(c.calls || [])]);
    if (h.error) setMessage(h.error);
  }
  useEffect(() => {
    let live = true;
    const run = () => {
      if (live) void load();
    };
    run();
    const timer = setInterval(run, 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const control = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/catalogue?q=" + encodeURIComponent(query), {
        signal: control.signal,
      })
        .then((r) => r.json())
        .then((d) => setGames(d.games || []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(timer);
      control.abort();
    };
  }, [query]);
  async function action(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (data.session?.access_token || ""),
        },
        body: JSON.stringify(body),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Request failed");
      setMessage(
        body.action === "update"
          ? `Updated ${value.total} games; ${value.added} new; ${value.missing} absent records retained. ${value.artworkWarning || ""}`
          : "Saved",
      );
      if (body.action === "create") onHunt(value.result);
      if (body.action === "delete") {
        onHunt("");
        setMessage(
          "Hunt deleted from the website. Its saved records are retained for recovery.",
        );
      }
      await load();
      if (body.action === "override") {
        const refreshed = await fetch(
          "/api/catalogue?q=" + encodeURIComponent(query),
        ).then((r) => r.json());
        setGames(refreshed.games || []);
      }
      onChange();
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const manualRequest = useRef<string | null>(null);
  const [manualBet, setManualBet] = useState("0.20");
  const current = hunts.find((h) => h.id === huntId);
  const manualGames = [
    ...new Map(
      games
        .filter((g) => g.enabled !== false)
        .map((g) => [
          g.name.toLowerCase() + "|" + providerName(g.provider, g.producer),
          g,
        ]),
    ).values(),
  ];
  const input =
    "min-w-0 rounded-lg border border-purple-300/20 bg-black px-3 py-2 text-sm text-white";
  const button =
    "rounded-lg border border-purple-300/25 bg-purple-400/10 px-3 py-2 text-xs font-bold disabled:opacity-40";
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-purple-300/15 bg-black/40 p-3 text-white">
      {!manual && (
        <details>
          <summary className="cursor-pointer text-sm font-bold text-purple-200">
            Catalogue administration
          </summary>
          <div className="mt-3 space-y-2">
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                action("/api/admin/catalogue", { action: "update" })
              }
            >
              Update catalogue
            </button>
            <p className="text-xs text-white/50">
              Refresh names and providers. Preserve corrections, aliases and
              history. Existing artwork mappings stay; new games may need
              images.
            </p>
            <input
              aria-label="Find catalogue game"
              className={input + " w-full"}
              placeholder="Search games to correct or confirm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Catalogue game"
              className={input + " w-full"}
              value={choice}
              onChange={(e) => {
                setChoice(e.target.value);
                const game = games.find((g) => g.identifier === e.target.value);
                setAliases((game?.aliases || []).join(", "));
                setCorrectedName(game?.name || "");
                setImageUrl(game?.artwork_url || "");
              }}
            >
              <option value="">Choose exact game / provider</option>
              {games.map((g) => (
                <option key={g.identifier} value={g.identifier}>
                  {g.name} · {g.provider} · {g.identifier}
                </option>
              ))}
            </select>
            <input
              aria-label="Corrected game name"
              className={input + " w-full"}
              value={correctedName}
              onChange={(e) => setCorrectedName(e.target.value)}
              placeholder="Game name"
            />
            <input
              aria-label="Game artwork URL"
              className={input + " w-full"}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="HTTPS artwork URL"
            />
            <input
              aria-label="Game aliases"
              className={input + " w-full"}
              value={aliases}
              placeholder="Aliases, separated by commas"
              onChange={(e) => setAliases(e.target.value)}
            />
            <button
              className={button}
              disabled={busy || !choice}
              onClick={() =>
                action("/api/admin/catalogue", {
                  action: "override",
                  identifier: choice,
                  name: correctedName,
                  artwork_url: imageUrl,
                  aliases: aliases
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            >
              Save game corrections
            </button>
            <button
              className={button}
              disabled={busy || !choice}
              onClick={() =>
                action("/api/admin/catalogue", {
                  action: "override",
                  identifier: choice,
                  enabled:
                    games.find((g) => g.identifier === choice)?.enabled ===
                    false,
                })
              }
            >
              Toggle enabled / disabled
            </button>
          </div>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="New hunt title"
          className={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New site hunt name"
        />
        <input
          aria-label="Recovery target"
          className={input + " w-32"}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="Starting bankroll"
        />
        <button
          className={button}
          disabled={busy || !title || !start}
          onClick={() =>
            action("/api/admin/site-tracker", {
              action: "create",
              title,
              start,
            })
          }
        >
          Create site hunt
        </button>
      </div>
      <label className="block text-xs">
        Save selected Twitch calls to
        <select
          aria-label="Tracker hunt"
          className={input + " mt-1 w-full"}
          value={huntId}
          onChange={(e) => onHunt(e.target.value)}
        >
          <option value="">Select a site hunt</option>
          {hunts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.title} · {h.phase}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <>
          <HuntSettings
            key={current.id + ":" + current.title + ":" + current.startCost}
            hunt={current}
            busy={busy}
            save={(body) => action("/api/admin/site-tracker", body)}
          />
          <div className="flex flex-wrap gap-2">
            {["collecting", "opening", "finished"].map((phase) => (
              <button
                key={phase}
                className={button}
                disabled={
                  busy ||
                  phase === current.phase ||
                  current.phase === "finished"
                }
                onClick={() =>
                  action("/api/admin/site-tracker", {
                    action: "phase",
                    huntId,
                    phase,
                  })
                }
              >
                {phase}
              </button>
            ))}
          </div>
          <p className="text-xs">
            Returns ${current.stats.totalWinnings.toFixed(2)} · P/L $
            {current.stats.profitLoss.toFixed(2)} · Running{" "}
            {current.stats.currentAverageMultiplier.toFixed(2)}× · Required{" "}
            {current.stats.averagePayoutRequired?.toFixed(2) ?? "—"}×
          </p>
          {manual && (
            <div className="space-y-3 rounded-xl border border-purple-300/20 bg-purple-400/5 p-4">
              <h3 className="font-bold">Add a collected bonus</h3>
              <input
                aria-label="Find slot to add"
                className={input + " w-full"}
                placeholder="Start typing a slot name…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setChoice("");
                }}
              />
              <select
                aria-label="Slot to add"
                className={input + " w-full"}
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
              >
                <option value="">Select a slot and provider</option>
                {manualGames.map((g) => (
                  <option key={g.identifier} value={g.identifier}>
                    {g.name} · {providerName(g.provider, g.producer)}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs">
                  Bet size
                  <input
                    aria-label="Manual bonus bet size"
                    className={input + " mt-1 block w-32"}
                    inputMode="decimal"
                    value={manualBet}
                    onChange={(e) => setManualBet(e.target.value)}
                  />
                </label>
                <button
                  className={button}
                  disabled={busy || !choice || current.phase !== "collecting"}
                  onClick={async () => {
                    if (
                      await action("/api/admin/site-tracker", {
                        action: "manual",
                        huntId,
                        identifier: choice,
                        bet: manualBet,
                        requestId: (manualRequest.current ??=
                          crypto.randomUUID()),
                      })
                    ) {
                      manualRequest.current = null;
                      setChoice("");
                      setQuery("");
                    }
                  }}
                >
                  Add to hunt
                </button>
              </div>
              <p className="text-xs text-white/50">
                Wheel bonuses and manual bonuses share this hunt. Add bonuses
                while collecting; record payouts when opening.
              </p>
            </div>
          )}
          {manual && (
            <div className="max-h-[36rem] space-y-2 overflow-auto">
              {current.entries.map((entry) => (
                <BonusRow
                  key={[
                    entry.id,
                    entry.bet_size,
                    entry.collection_cost,
                    entry.payout,
                  ].join(":")}
                  entry={entry}
                  nextId={
                    current.entries
                      .slice(current.entries.indexOf(entry) + 1)
                      .find(
                        (e) => e.status === "collected" && e.payout === null,
                      )?.id
                  }
                  disabled={busy || current.phase === "finished"}
                  save={(body) => action("/api/admin/site-tracker", body)}
                />
              ))}
            </div>
          )}
        </>
      )}
      {!manual && review.length > 0 && (
        <details open>
          <summary>Confirm or correct calls ({review.length})</summary>
          <p className="my-2 text-xs text-white/50">
            Search and select the exact catalogue game above, then confirm its
            call below. Unconfirmed calls stay out of the wheel.
          </p>
          {review.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <span>
                {c.username}: {c.slot_name}
              </span>
              <button
                className={button}
                disabled={busy || !choice}
                onClick={() =>
                  action("/api/admin/site-tracker", {
                    action: "resolve",
                    callId: c.id,
                    identifier: choice,
                  })
                }
              >
                Confirm selected game
              </button>
            </div>
          ))}
        </details>
      )}
      <p role="status" className="text-xs text-purple-200">
        {message}
      </p>
    </div>
  );
}
function BonusRow({
  entry,
  disabled,
  save,
  nextId,
}: {
  entry: Entry;
  nextId?: string;
  disabled: boolean;
  save: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [payout, setPayout] = useState(entry.payout ?? ""),
    [bet, setBet] = useState(String(entry.bet_size)),
    [cost, setCost] = useState(String(entry.collection_cost));
  return (
    <div className="rounded-lg border border-white/10 p-2 text-xs">
      <p>
        {entry.slot_name} · {entry.username} · {entry.status}
      </p>
      {entry.status === "collected" && (
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="text-white/60">
            Bet size
            <input
              aria-label={`Bet for ${entry.slot_name}`}
              className="mt-1 block w-28 rounded-lg border border-white/15 bg-black p-2 text-white"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
            />
          </label>
          <label className="text-white/60">
            Collection cost
            <input
              aria-label={`Cost for ${entry.slot_name}`}
              className="mt-1 block w-28 rounded-lg border border-white/15 bg-black p-2 text-white"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          <label className="text-white/60">
            Payout
            <input
              id={"tracker-payout-" + entry.id}
              aria-label={`Payout for ${entry.slot_name}`}
              className="mt-1 block w-28 rounded-lg border border-white/15 bg-black p-2 text-white"
              placeholder="Payout"
              value={payout}
              onChange={(e) => setPayout(e.target.value)}
            />
          </label>
          <button
            disabled={disabled}
            onClick={async () => {
              if (
                (await save({
                  action: "payout",
                  entryId: entry.id,
                  bet,
                  cost,
                  payout: payout.trim() === "" ? null : payout,
                })) &&
                nextId
              )
                requestAnimationFrame(() =>
                  document.getElementById("tracker-payout-" + nextId)?.focus(),
                );
            }}
          >
            Save and next
          </button>
        </div>
      )}
      {entry.payout === null && !entry.call_id.startsWith("manual:") && (
        <button
          className="mt-2 text-purple-200"
          disabled={disabled}
          onClick={() => save({ action: "undo", entryId: entry.id })}
        >
          Undo result / return to wheel
        </button>
      )}
      <button
        className="mt-2 ml-3 text-red-300 disabled:opacity-40"
        disabled={disabled}
        onClick={() => {
          if (
            confirm(
              `Remove ${entry.slot_name} from this hunt? Totals will recalculate. Saved data remains recoverable.`,
            )
          )
            void save({ action: "removeEntry", entryId: entry.id });
        }}
      >
        Remove from hunt
      </button>
    </div>
  );
}

function HuntSettings({
  hunt,
  busy,
  save,
}: {
  hunt: Hunt;
  busy: boolean;
  save: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(hunt.title);
  const [start, setStart] = useState(String(hunt.startCost));
  const [confirmTitle, setConfirmTitle] = useState("");
  const input =
    "w-full rounded-lg border border-purple-300/20 bg-black px-3 py-2 text-sm text-white";
  return (
    <details className="rounded-lg border border-white/10 p-3">
      <summary className="cursor-pointer text-sm font-bold text-purple-200">
        Edit or delete hunt
      </summary>
      <div className="mt-3 space-y-3">
        <label className="block text-xs">
          Hunt title
          <input
            aria-label="Edit hunt title"
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-xs">
          Starting bankroll
          <input
            aria-label="Edit starting bankroll"
            inputMode="decimal"
            className={input}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <button
          disabled={busy || !title.trim() || !start.trim()}
          className="rounded-lg bg-purple-400/20 px-3 py-2 text-sm disabled:opacity-40"
          onClick={() =>
            save({ action: "edit", huntId: hunt.id, title, start })
          }
        >
          Save hunt settings
        </button>
        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-xs text-white/60">
            Delete removes this hunt from the website. Saved results are
            retained for recovery. Queued calls and other hunts stay unchanged.
          </p>
          <label className="block text-xs">
            Type {hunt.title} to confirm
            <input
              aria-label="Confirm hunt deletion"
              className={input}
              value={confirmTitle}
              onChange={(e) => setConfirmTitle(e.target.value)}
            />
          </label>
          <button
            disabled={busy || confirmTitle !== hunt.title}
            className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200 disabled:opacity-40"
            onClick={() =>
              save({ action: "delete", huntId: hunt.id, confirmTitle })
            }
          >
            Delete hunt
          </button>
        </div>
      </div>
    </details>
  );
}
