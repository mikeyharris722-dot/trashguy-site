"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PokerView } from "@/lib/poker-engine";
import { siteFetch } from "@/lib/site-fetch";
import { startPolling } from "@/lib/polling";
import styles from "./poker-night.module.css";
const number = (n: number) => n.toLocaleString();
const blindInterval = (e: NonNullable<PokerView["event"]>) =>
  e.blindMode === "hands"
    ? `${e.handsPerLevel ?? 10} hands`
    : `${e.levelMinutes} minutes`;
function Card({ value, back = false }: { value?: number; back?: boolean }) {
  return (
    <span
      className={`${styles.card} ${back ? styles.back : ""} ${value !== undefined && [1, 2].includes(Math.floor(value / 13)) ? styles.red : ""}`}
      aria-label={
        back
          ? "Hidden card"
          : value === undefined
            ? "Undealt"
            : "23456789TJQKA"[value % 13] +
              [" clubs", " diamonds", " hearts", " spades"][
                Math.floor(value / 13)
              ]
      }
    >
      {back ? "♠" : value === undefined ? "" : "23456789TJQKA"[value % 13]}
      {!back && value !== undefined && (
        <small>{"♣♦♥♠"[Math.floor(value / 13)]}</small>
      )}
    </span>
  );
}
function PokerSettingsFields({ event }: { event?: PokerView["event"] }) {
  const [mode, setMode] = useState(event?.blindMode ?? "time");
  return (
    <div className={styles.formGrid}>
      <label className={styles.field}>
        Event name
        <input
          name="title"
          defaultValue={event?.title || "Trash Poker Night"}
          maxLength={70}
          required
        />
      </label>
      <label className={styles.field}>
        Starting chips
        <input
          name="startingChips"
          type="number"
          defaultValue={event?.startingChips ?? 10000}
          min="100"
          max="1000000"
          required
        />
      </label>
      <label className={styles.field}>
        Seats per table
        <select name="seatsPerTable" defaultValue={event?.seatsPerTable ?? 9}>
          {Array.from({ length: 8 }, (_, i) => (
            <option key={i} value={i + 2}>
              {i + 2} players
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Starting small blind
        <input
          name="smallBlind"
          type="number"
          defaultValue={event?.smallBlind ?? 25}
          min="1"
          max="10000"
          required
        />
      </label>
      <label className={styles.field}>
        Blind levels by
        <select
          name="blindMode"
          value={mode}
          onChange={(ev) => setMode(ev.target.value as "time" | "hands")}
        >
          <option value="time">Time interval</option>
          <option value="hands">Number of hands</option>
        </select>
      </label>
      {mode === "time" ? (
        <label className={styles.field}>
          Increase blinds every (minutes)
          <input
            name="levelMinutes"
            type="number"
            defaultValue={event?.levelMinutes ?? 10}
            min="1"
            max="60"
            required
          />
        </label>
      ) : (
        <label className={styles.field}>
          Increase blinds every (hands)
          <input
            name="handsPerLevel"
            type="number"
            defaultValue={event?.handsPerLevel ?? 10}
            min="1"
            max="100"
            required
          />
        </label>
      )}
      <label className={styles.field}>
        Blind increase
        <select
          name="blindMultiplier"
          defaultValue={event?.blindMultiplier ?? 2}
        >
          <option value="1.5">1.5× each level</option>
          <option value="2">2× each level (double)</option>
          <option value="3">3× each level</option>
        </select>
      </label>
      <label className={styles.field}>
        Turn timer (seconds)
        <input
          name="turnSeconds"
          type="number"
          defaultValue={event?.turnSeconds ?? 30}
          min="15"
          max="90"
          required
        />
      </label>
    </div>
  );
}
export default function PokerNight({
  admin = false,
  onVisibilityChange,
}: {
  admin?: boolean;
  onVisibilityChange?: (enabled: boolean) => void;
}) {
  const [view, setView] = useState<PokerView | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmEnd, setConfirmEnd] = useState(false),
    [selected, setSelected] = useState(""),
    [raise, setRaise] = useState(""),
    [query, setQuery] = useState(""),
    [users, setUsers] = useState<{ id: string; username: string }[]>([]),
    [searching, setSearching] = useState(false),
    [now, setNow] = useState(Date.now());
  const current = useRef<PokerView | null>(null),
    pending = useRef(false),
    clockOffset = useRef(0);
  const load = useCallback(async () => {
    const response = await siteFetch("/api/poker" + (admin ? "?admin=1" : ""), {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Could not load Poker Night.");
    if (current.current && data.version < current.current.version)
      return current.current;
    onVisibilityChange?.(data.enabled === true);
    clockOffset.current = Date.now() - data.serverTime;
    current.current = data;
    setView(data);
    return data as PokerView;
  }, [admin, onVisibilityChange]);
  const send = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (pending.current) return;
      const snapshot = current.current;
      if (!snapshot) return;
      pending.current = true;
      setBusy(true);
      setError("");
      try {
        const response = await siteFetch("/api/poker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...extra,
            eventId: snapshot.event?.id,
            version: snapshot.version,
            requestId: crypto.randomUUID(),
          }),
          signal: AbortSignal.timeout(20000),
        });
        const result = await response.json();
        if (!response.ok)
          throw Error(
            result.error || "Could not save. Refresh before trying again.",
          );
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
        await load().catch(() => {});
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [load],
  );
  const running = view?.event?.status === "running";
  useEffect(
    () =>
      startPolling(
        async () => {
          try {
            if (pending.current) return;
            const data = await load();
            setError("");
            const e = data.event;
            if (
              data.viewerId &&
              e?.status === "running" &&
              ((e.nextRoundAt && e.nextRoundAt <= data.serverTime) ||
                e.tables.some(
                  (t) =>
                    t.hand &&
                    !t.hand.done &&
                    t.hand.deadline <= data.serverTime,
                ))
            )
              await send("tick");
            return true;
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Poker Night is temporarily unavailable.",
            );
            return false;
          }
        },
        running ? 2000 : 10000,
      ),
    [load, send, running],
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setUsers([]);
    if (!admin || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await siteFetch(
          "/api/admin/tracker-users?q=" + encodeURIComponent(query.trim()),
          { signal: controller.signal },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Search failed.");
        setUsers(d.users || []);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, admin]);
  const e = view?.event,
    me = e?.players.find((p) => p.id === view?.viewerId),
    table =
      e?.tables.find((t) => t.id === selected) ||
      e?.tables.find((t) => t.players.includes(view?.viewerId || "")) ||
      e?.tables[0],
    hand = table?.hand,
    seat = hand?.seats[hand.turn],
    mine = hand?.seats.find((s) => s.id === view?.viewerId),
    yourTurn = !!(running && seat?.id === view?.viewerId && !hand?.done),
    owed = mine && hand ? Math.max(0, hand.price - mine.bet) : 0;
  const time = hand
    ? Math.max(0, Math.ceil((hand.deadline + clockOffset.current - now) / 1000))
    : 0;
  const button = (
    text: string,
    action: string,
    extra: Record<string, unknown> = {},
    danger = false,
  ) => (
    <button
      type="button"
      className={danger ? styles.danger : styles.button}
      disabled={busy}
      onClick={() => void send(action, extra)}
    >
      {text}
    </button>
  );
  const play = (action: string, extra: Record<string, unknown> = {}) =>
    void send(action, {
      tableId: table?.id,
      handId: hand?.id,
      turnId: hand?.turnId,
      ...extra,
    });
  return (
    <section
      className={styles.root}
      aria-label={admin ? "Poker Night administration" : "Poker Night"}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>TRASHGUY COMMUNITY</span>
          <h2>♠ Poker Night</h2>
          <p>Texas Hold’em · free entry · tournament chips only</p>
        </div>
        {admin &&
          view?.admin &&
          button(
            view.enabled ? "Hide Poker Night" : "Enable Poker Night",
            "enabled",
            { enabled: !view.enabled },
          )}
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!view && <div className={styles.panel}>Loading Poker Night…</div>}
      {view && !view.enabled && !admin && (
        <div className={styles.panel}>
          Poker Night isn’t open yet. Check back for the next event.
        </div>
      )}
      {view && (view.enabled || admin) && (
        <>
          {e ? (
            <>
              <div className={styles.eventHeading}>
                <div>
                  <h3>{e.title}</h3>
                  <span className={styles.status}>
                    {e.status === "registration"
                      ? e.registrationOpen
                        ? "Registration open"
                        : "Registration closed"
                      : e.status}
                  </span>
                </div>
                {e.status === "registration" && !admin && (
                  <div>
                    {!view.viewerId ? (
                      <span>Sign in with Twitch to join.</span>
                    ) : me ? (
                      <>
                        {me.status === "pending"
                          ? "Awaiting approval"
                          : "You’re approved"}{" "}
                        {button("Leave", "leave")}
                      </>
                    ) : (
                      button("Sign up", "join")
                    )}
                  </div>
                )}
              </div>
              <div className={styles.stats}>
                <div>
                  <small>PLAYERS</small>
                  <strong>
                    {e.players.filter((p) => p.status === "approved").length} /
                    90
                  </strong>
                </div>
                <div>
                  <small>STARTING CHIPS</small>
                  <strong>{number(e.startingChips)}</strong>
                </div>
                <div>
                  <small>BLINDS</small>
                  <strong>
                    {number(e.blind)} / {number(e.blind * 2)}
                  </strong>
                </div>
                <div>
                  <small>{e.round ? "HAND" : "LEVEL LENGTH"}</small>
                  <strong>{e.round || blindInterval(e)}</strong>
                </div>
              </div>
              {e.tables.length > 0 && (
                <div className={styles.panel}>
                  <div className={styles.tableHeader}>
                    <h3>
                      {e.tables.length === 1 ? "Final table" : "Live tables"}
                    </h3>
                    <label>
                      Watching{" "}
                      <select
                        value={table?.id || ""}
                        onChange={(ev) => setSelected(ev.target.value)}
                      >
                        {e.tables.map((t, i) => (
                          <option key={t.id} value={t.id}>
                            Table {i + 1}
                            {t.players.includes(view.viewerId)
                              ? " · your table"
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className={styles.felt}>
                    <div className={styles.tableBrand}>
                      TRASHGUY <span>POKER NIGHT</span>
                    </div>
                    <div className={styles.board}>
                      <div className={styles.cards}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Card key={i} value={hand?.board[i]} />
                        ))}
                      </div>
                      <strong>
                        {hand
                          ? `Pot · ${number(hand.pot)}`
                          : "Waiting for the deal"}
                      </strong>
                      <small>
                        {e.status === "paused"
                          ? "Play paused"
                          : hand?.done
                            ? "Hand complete"
                            : `Hand ${e.round} · ${["Pre-flop", "Flop", "Turn", "River"][hand?.street || 0]}`}
                      </small>
                    </div>
                    <div className={styles.seats}>
                      {hand?.seats.map((s, i) => {
                        const p = e.players.find((p) => p.id === s.id),
                          active = running && hand.turn === i && !hand.done;
                        return (
                          <div
                            key={s.id}
                            style={{
                              left: `${50 + 39 * Math.cos(Math.PI / 2 + (i * 2 * Math.PI) / hand.seats.length)}%`,
                              top: `${50 + 36 * Math.sin(Math.PI / 2 + (i * 2 * Math.PI) / hand.seats.length)}%`,
                            }}
                            className={`${styles.seat} ${active ? styles.active : ""} ${s.folded ? styles.folded : ""}`}
                          >
                            <div className={styles.seatTitle}>
                              <span>
                                {p?.name || "Player"}
                                {s.id === view.viewerId ? " (you)" : ""}
                              </span>
                              {hand.dealer === i && <b title="Dealer">D</b>}
                            </div>
                            <strong>
                              {number(p?.chips || 0)} <small>chips</small>
                            </strong>
                            <div className={styles.hole}>
                              {s.cards.length ? (
                                s.cards.map((c, j) => (
                                  <Card key={j} value={c} />
                                ))
                              ) : (
                                <>
                                  <Card back />
                                  <Card back />
                                </>
                              )}
                            </div>
                            <small>
                              {s.folded
                                ? "Folded"
                                : active
                                  ? e.status === "paused"
                                    ? "Paused"
                                    : `${time}s · thinking`
                                  : p?.chips === 0 && !hand.done
                                    ? "All-in"
                                    : s.bet
                                      ? `Bet ${number(s.bet)}`
                                      : ""}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {hand?.done && (
                    <div className={styles.result} aria-live="polite">
                      {hand.result.map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                      {running && (
                        <small>
                          Waiting for all tables before the next hand.
                        </small>
                      )}
                    </div>
                  )}
                  {yourTurn && (
                    <div
                      className={styles.actions}
                      aria-label="Your poker actions"
                    >
                      <strong>Your turn · {time}s</strong>
                      <div className={styles.actionButtons}>
                        <button
                          disabled={busy}
                          onClick={() => play("fold")}
                          className={styles.danger}
                        >
                          Fold
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => play(owed ? "call" : "check")}
                          className={styles.button}
                        >
                          {owed
                            ? `Call ${number(Math.min(owed, me?.chips || 0))}`
                            : "Check"}
                        </button>
                        {mine?.canRaise && (me?.chips || 0) > owed && (
                          <>
                            <label>
                              Raise to
                              <input
                                aria-label="Raise total"
                                type="number"
                                min={hand!.price + hand!.minRaise}
                                step="1"
                                placeholder={String(
                                  hand!.price + hand!.minRaise,
                                )}
                                value={raise}
                                onChange={(ev) => setRaise(ev.target.value)}
                              />
                            </label>
                            <button
                              className={styles.button}
                              disabled={busy || !raise}
                              onClick={() =>
                                play("raise", { amount: Number(raise) })
                              }
                            >
                              Raise
                            </button>
                          </>
                        )}
                        <button
                          disabled={
                            busy || (!mine?.canRaise && (me?.chips || 0) > owed)
                          }
                          className={styles.button}
                          onClick={() => play("allin")}
                        >
                          All-in
                        </button>
                      </div>
                    </div>
                  )}
                  {!yourTurn && me && running && !hand?.done && (
                    <p className={styles.note}>
                      {me.chips === 0
                        ? "You’re all-in or eliminated. Watch the action here."
                        : table?.players.includes(me.id)
                          ? "Waiting for your turn. Your cards are private."
                          : "You’re watching another table. Select your table above."}
                    </p>
                  )}
                </div>
              )}
              <div className={styles.lowerGrid}>
                <div className={styles.panel}>
                  <h3>
                    {e.status === "registration"
                      ? "Approved players"
                      : "Tournament standings"}
                  </h3>
                  <div className={styles.playerList}>
                    {[...e.players]
                      .filter((p) => p.status === "approved")
                      .sort(
                        (a, b) =>
                          (a.rank || 999) - (b.rank || 999) ||
                          b.chips - a.chips,
                      )
                      .map((p) => (
                        <div key={p.id}>
                          <span>
                            {p.rank ? `#${p.rank} ` : ""}
                            {p.name}
                            {p.id === view.viewerId ? " · you" : ""}
                          </span>
                          <strong>
                            {e.status === "registration"
                              ? number(e.startingChips)
                              : number(p.chips)}
                          </strong>
                          {admin &&
                            view.admin &&
                            e.status === "registration" &&
                            button(
                              "Remove",
                              "remove",
                              { playerId: p.id },
                              true,
                            )}
                        </div>
                      ))}
                    {!e.players.some((p) => p.status === "approved") && (
                      <p>No approved players yet.</p>
                    )}
                  </div>
                </div>
                <div className={styles.panel}>
                  <h3>
                    {e.status === "registration"
                      ? "How it works"
                      : "Table activity"}
                  </h3>
                  {e.status === "registration" ? (
                    <p>
                      Sign up, wait for admin approval and take your seat.
                      Tables are dealt hand-for-hand and balanced between
                      rounds. Blinds increase {e.blindMultiplier ?? 2}× every{" "}
                      {blindInterval(e)}. Turns last {e.turnSeconds} seconds; a
                      missed turn checks when possible, otherwise folds.
                      Reconnect here to continue.
                    </p>
                  ) : (
                    <ol className={styles.log}>
                      {e.log.slice(0, 12).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
              {admin && view.admin && (
                <div className={styles.panel}>
                  <details className="mb-4 rounded-lg border border-purple-300/15 p-3">
                    <summary className="cursor-pointer text-sm font-bold text-purple-100">
                      Poker settings
                    </summary>
                    {e.status === "registration" ? (
                      <form
                        key={
                          e.id +
                          ":" +
                          [
                            e.title,
                            e.startingChips,
                            e.seatsPerTable,
                            e.smallBlind,
                            e.levelMinutes,
                            e.blindMultiplier,
                            e.blindMode,
                            e.handsPerLevel,
                            e.turnSeconds,
                          ].join()
                        }
                        onSubmit={(ev) => {
                          ev.preventDefault();
                          void send(
                            "settings",
                            Object.fromEntries(new FormData(ev.currentTarget)),
                          );
                        }}
                      >
                        <PokerSettingsFields event={e} />
                        <button className={styles.button} disabled={busy}>
                          Save poker settings
                        </button>
                        <p>Settings lock when play starts.</p>
                      </form>
                    ) : (
                      <p className="mt-3">
                        Starting chips: {number(e.startingChips)} ·{" "}
                        {e.seatsPerTable} seats per table · starting blinds{" "}
                        {e.smallBlind}/{e.smallBlind * 2} · increase{" "}
                        {e.blindMultiplier ?? 2}× every {blindInterval(e)}·{" "}
                        {e.turnSeconds}-second turns. Settings are locked for
                        this tournament.
                      </p>
                    )}
                  </details>
                  <h3>Event controls</h3>
                  <div className={styles.controls}>
                    {e.status === "registration" ? (
                      <>
                        {button(
                          e.registrationOpen
                            ? "Close registration"
                            : "Open registration",
                          "registration",
                          { open: !e.registrationOpen },
                        )}
                        {button("Start tournament", "start")}
                      </>
                    ) : e.status === "running" ? (
                      button("Pause play", "pause")
                    ) : e.status === "paused" ? (
                      button("Resume play", "resume")
                    ) : null}
                    {e.status !== "finished" && (
                      <button
                        className={styles.danger}
                        disabled={busy}
                        onClick={() => {
                          setConfirmEnd(true);
                        }}
                      >
                        End event
                      </button>
                    )}
                  </div>
                  {confirmEnd && (
                    <div className={styles.error} role="alert">
                      <p>End this poker night? Play will stop immediately.</p>
                      <div className={styles.controls}>
                        <button
                          className={styles.danger}
                          disabled={busy}
                          onClick={() => {
                            setConfirmEnd(false);
                            void send("end");
                          }}
                        >
                          Confirm end event
                        </button>
                        <button
                          className={styles.button}
                          onClick={() => setConfirmEnd(false)}
                        >
                          Keep playing
                        </button>
                      </div>
                    </div>
                  )}
                  {e.status === "registration" && (
                    <div className={styles.lowerGrid}>
                      <div>
                        <h4>Awaiting approval ({e.pendingCount})</h4>
                        <div className={styles.playerList}>
                          {e.players
                            .filter((p) => p.status === "pending")
                            .map((p) => (
                              <div key={p.id}>
                                <span>{p.name}</span>
                                {button("Approve", "approve", {
                                  playerId: p.id,
                                })}
                                {button(
                                  "Remove",
                                  "remove",
                                  { playerId: p.id },
                                  true,
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                      <div>
                        <h4>Add a registered player</h4>
                        <label className={styles.field}>
                          Search Twitch username
                          <input
                            value={query}
                            maxLength={50}
                            onChange={(ev) => setQuery(ev.target.value)}
                            placeholder="Type at least 2 characters"
                          />
                        </label>
                        {searching && <p>Searching…</p>}
                        <div className={styles.playerList}>
                          {users.map((user) => (
                            <div key={user.id}>
                              <span>{user.username}</span>
                              {button("Add approved", "add", {
                                profileId: user.id,
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            !admin && (
              <div className={styles.panel}>
                The next Poker Night will appear here when it’s announced.
              </div>
            )
          )}
          {admin && view.admin && (!e || e.status === "finished") && (
            <form
              className={styles.panel}
              onSubmit={(ev) => {
                ev.preventDefault();
                const data = new FormData(ev.currentTarget);
                void send("create", Object.fromEntries(data));
              }}
            >
              <h3>Create a Poker Night</h3>
              <p>
                Free-entry tournament · up to 90 players · no cash value or
                buy-ins
              </p>
              <PokerSettingsFields />
              <button className={styles.button} disabled={busy}>
                Create event
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
