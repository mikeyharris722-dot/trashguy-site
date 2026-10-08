"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import OpeningSession from "./tracker-opening";
import SlotSearch, { type SlotOption } from "./slot-search";
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
export type Entry = {
  id: string;
  call_id: string;
  artwork_url?: string | null;
  bonus_tier: string;
  notes: string;
  slot_name: string;
  username: string;
  status: string;
  bet_size: string;
  payout: string | null;
  collection_cost: string;
};
type Hunt = {
  openingQueue?: string[];
  id: string;
  source?: string;
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
  community = false,
}: {
  huntId: string;
  onHunt: (id: string) => void;
  onChange: () => void;
  manual?: boolean;
  community?: boolean;
}) {
  const [hunts, setHunts] = useState<Hunt[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [title, setTitle] = useState(""),
    [start, setStart] = useState(""),
    [query, setQuery] = useState(""),
    [games, setGames] = useState<Game[]>([]),
    [choice, setChoice] = useState(""),
    [aliases, setAliases] = useState(""),
    [correctedName, setCorrectedName] = useState(""),
    [imageUrl, setImageUrl] = useState("");
  const communityMode =
    community || hunts.find((h) => h.id === huntId)?.source === "community";
  const trackerApi = communityMode
    ? "/api/community/tracker"
    : "/api/admin/site-tracker";
  const catalogueApi = communityMode ? "/api/community" : "/api/catalogue";
  const load = useCallback(async () => {
    const { data: session } = await supabaseBrowser.auth.getSession();
    const h = await fetch(
      community ? "/api/community/tracker" : "/api/site-tracker",
      {
        cache: "no-store",
        headers: true
          ? { Authorization: "Bearer " + (session.session?.access_token || "") }
          : {},
      },
    ).then((r) => r.json());
    setHunts(h.hunts || []);
    if (h.error) setMessage(h.error);
  }, [community]);
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
  }, [load]);
  useEffect(() => {
    const control = new AbortController();
    const timer = setTimeout(() => {
      fetch(catalogueApi + "?q=" + encodeURIComponent(query), {
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
  }, [query, catalogueApi]);
  const communityRequest = useRef<{ body: string; id: string } | null>(null);
  async function action(path: string, body: Record<string, unknown>) {
    const key = JSON.stringify({ huntId, ...body });
    if (communityRequest.current?.body !== key)
      communityRequest.current = { body: key, id: crypto.randomUUID() };
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
        body: JSON.stringify(
          communityMode
            ? { huntId, requestId: communityRequest.current.id, ...body }
            : body,
        ),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Request failed");
      communityRequest.current = null;
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
  const [manualSlot, setManualSlot] = useState<SlotOption | null>(null);
  const [manualTier, setManualTier] = useState("standard");
  const [manualNotes, setManualNotes] = useState("");
  const [searchReset, setSearchReset] = useState(0);
  const manualRequest = useRef<string | null>(null);
  const [manualBet, setManualBet] = useState("0.20");
  const [opening, setOpening] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const current = hunts.find((h) => h.id === huntId);
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
      <div className="rounded-xl border border-purple-300/20 bg-purple-500/5 p-4">
        <label className="block text-xs font-bold uppercase tracking-wider text-purple-200">
          Active hunt
          <select
            aria-label="Tracker hunt"
            className={input + " mt-2 w-full"}
            value={huntId}
            onChange={(e) => {
              setOpening(false);
              onHunt(e.target.value);
            }}
          >
            <option value="" disabled={Boolean(huntId)}>
              Select a hunt
            </option>
            {hunts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title} · {h.source === "community" ? "Community · " : ""}
                {h.phase}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-white/40">
          Shared by the wheel and tracker. Your selection stays active until you
          choose or create another hunt.
        </p>
      </div>
      {!communityMode && (
        <details className="rounded-xl border border-white/10 p-3">
          <summary className="cursor-pointer text-sm font-bold text-purple-200">
            Create a new hunt
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
            <input
              aria-label="New hunt title"
              className={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Hunt name"
            />
            <input
              aria-label="Recovery target"
              className={input}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              inputMode="decimal"
              placeholder="Starting bankroll"
            />
            <button
              className={button}
              disabled={busy || !title.trim() || !start.trim()}
              onClick={() =>
                action(trackerApi, {
                  action: "create",
                  title,
                  start,
                })
              }
            >
              Create hunt
            </button>
          </div>
        </details>
      )}
      {manual && (
        <details className="rounded-lg border border-teal-300/20 p-3">
          <summary className="cursor-pointer font-bold text-teal-200">
            OBS overlay
          </summary>
          <p className="mt-2 text-xs text-white/60">
            Add a Browser Source in OBS. Use this overlay URL, width 435 and
            height 285. It follows the active hunt. Collection scrolls; opening
            stays still and follows skips.
          </p>
          <input
            readOnly
            aria-label="OBS overlay URL"
            className={input + " mt-2 w-full"}
            value={
              typeof window !== "undefined"
                ? window.location.origin + "/overlay"
                : "/overlay"
            }
          />
          <a
            href="/overlay"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-teal-200"
          >
            Preview overlay ↗
          </a>
        </details>
      )}
      {current && (
        <>
          {!communityMode && (
            <HuntSettings
              key={current.id + ":" + current.title + ":" + current.startCost}
              hunt={current}
              busy={busy}
              save={(body) => action(trackerApi, body)}
            />
          )}
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
                onClick={async () => {
                  if (
                    await action(trackerApi, {
                      action: "phase",
                      huntId,
                      phase,
                    })
                  ) {
                    setOpening(phase === "opening");
                  }
                }}
              >
                {phase}
              </button>
            ))}
          </div>
          {manual && current.phase === "opening" && (
            <button
              className={button}
              disabled={busy}
              onClick={() => setOpening(true)}
            >
              Resume opening
            </button>
          )}
          {manual && opening && current.phase === "opening" && (
            <OpeningSession
              endpoint={trackerApi}
              key={current.id}
              huntId={current.id}
              initialQueue={current.openingQueue || []}
              entries={current.entries}
              busy={busy}
              onClose={() => setOpening(false)}
              save={(body) => action(trackerApi, body)}
            />
          )}
          <p className="text-xs">
            Returns ${current.stats.totalWinnings.toFixed(2)} · P/L $
            {current.stats.profitLoss.toFixed(2)} · Running{" "}
            {current.stats.currentAverageMultiplier.toFixed(2)}× · Required{" "}
            {current.stats.averagePayoutRequired?.toFixed(2) ?? "—"}×
          </p>
          {manual && (
            <section className="space-y-4 rounded-xl border border-purple-300/20 bg-purple-400/5 p-4">
              <h3 className="font-bold text-purple-100">Add a bonus</h3>
              {message.includes("already in the hunt") && (
                <p
                  role="alert"
                  className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-2 text-sm text-amber-200"
                >
                  This slot is already in the hunt.
                </p>
              )}
              <SlotSearch
                endpoint={catalogueApi}
                key={searchReset}
                selected={manualSlot}
                onSelect={(g) => {
                  setManualSlot(g);
                  manualRequest.current = null;
                }}
              />
              <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto]">
                <label className="text-xs text-white/60">
                  Bet size
                  <input
                    aria-label="Manual bonus bet size"
                    className={input + " mt-1 w-full"}
                    inputMode="decimal"
                    value={manualBet}
                    onChange={(e) => setManualBet(e.target.value)}
                  />
                </label>
                <label className="text-xs text-white/60">
                  Bonus type
                  <select
                    aria-label="Manual bonus type"
                    className={input + " mt-1 w-full"}
                    value={manualTier}
                    onChange={(e) => setManualTier(e.target.value)}
                  >
                    <option value="standard">Standard</option>
                    <option value="super">Super</option>
                    <option value="super_super">Super Super</option>
                  </select>
                </label>
                <button
                  className={button + " self-end"}
                  disabled={
                    busy || !manualSlot || current.phase !== "collecting"
                  }
                  onClick={async () => {
                    if (!manualSlot) return;
                    if (
                      await action(trackerApi, {
                        action: "manual",
                        huntId,
                        identifier: manualSlot.identifier,
                        bet: manualBet,
                        tier: manualTier,
                        notes: manualNotes,
                        requestId: (manualRequest.current ??=
                          crypto.randomUUID()),
                      })
                    ) {
                      manualRequest.current = null;
                      setManualSlot(null);
                      setManualNotes("");
                      setSearchReset((n) => n + 1);
                    }
                  }}
                >
                  Add to hunt
                </button>
              </div>
              <label className="block text-xs text-white/60">
                Notes (optional)
                <input
                  aria-label="Manual bonus notes"
                  maxLength={1000}
                  className={input + " mt-1 w-full"}
                  placeholder="Feature details or a reminder…"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                />
              </label>
            </section>
          )}
          {manual && (
            <div className="space-y-1.5">
              {current.entries.map((entry) => (
                <div
                  key={entry.id}
                  onDragOver={(e) => {
                    if (!busy && current.phase === "collecting")
                      e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (
                      !dragId ||
                      busy ||
                      current.phase !== "collecting" ||
                      dragId === entry.id
                    )
                      return;
                    const ids = current.entries.map((e) => e.id),
                      from = ids.indexOf(dragId),
                      to = ids.indexOf(entry.id);
                    if (from < 0) return;
                    ids.splice(from, 1);
                    ids.splice(to, 0, dragId);
                    setDragId(null);
                    void action(trackerApi, {
                      action: "reorder",
                      huntId,
                      entryIds: ids,
                    });
                  }}
                >
                  <BonusRow
                    draggable={!busy && current.phase === "collecting"}
                    onDrag={() => setDragId(entry.id)}
                    move={(direction) => {
                      const ids = current.entries.map((e) => e.id),
                        from = ids.indexOf(entry.id),
                        to = from + direction;
                      if (to < 0 || to >= ids.length) return;
                      [ids[from], ids[to]] = [ids[to], ids[from]];
                      void action(trackerApi, {
                        action: "reorder",
                        huntId,
                        entryIds: ids,
                      });
                    }}
                    key={[
                      entry.id,
                      entry.bet_size,
                      entry.collection_cost,
                      entry.payout,
                      entry.bonus_tier,
                      entry.notes,
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
                    save={(body) => action(trackerApi, body)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
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
  draggable,
  onDrag,
  move,
}: {
  entry: Entry;
  disabled: boolean;
  nextId?: string;
  draggable: boolean;
  onDrag: () => void;
  move: (direction: number) => void;
  save: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [payout, setPayout] = useState(entry.payout ?? ""),
    [bet, setBet] = useState(String(entry.bet_size)),
    [cost, setCost] = useState(String(entry.collection_cost)),
    [tier, setTier] = useState(entry.bonus_tier || "standard"),
    [notes, setNotes] = useState(entry.notes || "");
  const field =
    "mt-1 w-full rounded-lg border border-white/15 bg-black/70 p-2 text-sm text-white";
  const saveBonus = async () => {
    if (
      await save({
        action: "payout",
        entryId: entry.id,
        bet,
        cost,
        payout: payout.trim() === "" ? null : payout,
        tier,
        notes,
      })
    ) {
      if (nextId)
        requestAnimationFrame(() =>
          document.getElementById("tracker-payout-" + nextId)?.focus(),
        );
    }
  };
  return (
    <article className="grid items-center gap-x-3 min-w-0 rounded-lg border border-purple-300/15 bg-black/70 px-3 py-2 lg:grid-cols-[minmax(220px,1fr)_auto_170px]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-white/50">
          <button
            draggable={draggable}
            disabled={!draggable}
            onDragStart={onDrag}
            aria-label={`Drag ${entry.slot_name} to reorder`}
            className="cursor-grab px-1 py-2 disabled:opacity-20"
          >
            ⠿
          </button>
          <button
            disabled={!draggable}
            onClick={() => move(-1)}
            aria-label={`Move ${entry.slot_name} up`}
            className="disabled:opacity-20"
          >
            ↑
          </button>
          <button
            disabled={!draggable}
            onClick={() => move(1)}
            aria-label={`Move ${entry.slot_name} down`}
            className="disabled:opacity-20"
          >
            ↓
          </button>
        </div>
        {entry.artwork_url && (
          <Image
            unoptimized
            width={56}
            height={56}
            src={entry.artwork_url}
            alt=""
            className="h-9 w-9 rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-white">{entry.slot_name}</h3>
          <p
            className={
              "text-xs " +
              (entry.bonus_tier !== "standard"
                ? "font-black uppercase text-amber-300"
                : "text-white/45")
            }
          >
            {entry.username} ·{" "}
            {entry.bonus_tier === "super_super"
              ? "Super Super"
              : entry.bonus_tier === "super"
                ? "Super"
                : "Standard"}
          </p>
          <p className="mt-1 text-xs font-bold text-purple-200">
            Bet ${Number(entry.bet_size).toFixed(2)}
          </p>
        </div>
        <span
          className={
            "rounded px-2 py-1 text-[9px] font-bold " +
            (entry.status === "collected"
              ? "bg-emerald-400/10 text-emerald-300"
              : "bg-red-400/10 text-red-300")
          }
        >
          {entry.status === "collected" ? "GOT IN" : "FAILED"}
        </span>
      </div>
      {entry.notes && (
        <p className="order-last mt-1 rounded border-l-2 border-cyan-300 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-200 lg:col-span-3">
          ✎ {entry.notes}
        </p>
      )}
      {entry.status === "collected" && (
        <>
          <div className="mt-1 flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-white/60">
              Payout
              <input
                id={"tracker-payout-" + entry.id}
                aria-label={`Payout for ${entry.slot_name}`}
                className="w-28 rounded border border-white/15 bg-black px-2 py-1 text-sm"
                inputMode="decimal"
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
                placeholder="Pending"
                disabled={disabled}
              />
            </label>
            <button
              className="rounded-lg bg-purple-500/20 px-3 py-2 text-xs font-bold text-purple-100 disabled:opacity-40"
              disabled={disabled}
              onClick={saveBonus}
            >
              Save
            </button>
          </div>
          <details className="mt-1 lg:row-span-2">
            <summary className="cursor-pointer text-xs font-bold text-purple-200">
              Edit bonus details
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-white/60">
                Bet size
                <input
                  aria-label={`Bet for ${entry.slot_name}`}
                  className={field}
                  value={bet}
                  onChange={(e) => setBet(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label className="text-xs text-white/60">
                Collection cost
                <input
                  aria-label={`Cost for ${entry.slot_name}`}
                  className={field}
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label className="col-span-2 text-xs text-white/60">
                Bonus type
                <select
                  aria-label={`Bonus type for ${entry.slot_name}`}
                  className={field}
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                >
                  <option value="standard">Standard</option>
                  <option value="super">Super</option>
                  <option value="super_super">Super Super</option>
                </select>
              </label>
              <label className="col-span-2 text-xs text-white/60">
                Notes
                <textarea
                  aria-label={`Notes for ${entry.slot_name}`}
                  maxLength={1000}
                  className={field}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>
            <button
              disabled={disabled}
              className="mt-3 rounded-lg bg-purple-500/20 px-3 py-2 text-xs text-purple-100 disabled:opacity-40"
              onClick={saveBonus}
            >
              Save details
            </button>
          </details>
        </>
      )}
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] lg:col-span-2">
        {entry.payout === null && !entry.call_id.startsWith("manual:") && (
          <button
            disabled={disabled}
            className="text-purple-200 disabled:opacity-40"
            onClick={() => save({ action: "undo", entryId: entry.id })}
          >
            Undo / return to wheel
          </button>
        )}
        <button
          disabled={disabled}
          className="text-red-300 disabled:opacity-40"
          onClick={() => {
            if (
              confirm(
                `Remove ${entry.slot_name} from this hunt? Saved data remains recoverable.`,
              )
            )
              void save({ action: "removeEntry", entryId: entry.id });
          }}
        >
          Remove
        </button>
      </div>
    </article>
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
