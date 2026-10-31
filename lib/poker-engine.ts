import { randomInt, randomUUID } from "node:crypto";

export type Player = {
  id: string;
  name: string;
  status: "pending" | "approved";
  chips: number;
  rank?: number;
};
export type Seat = {
  id: string;
  cards: number[];
  folded: boolean;
  bet: number;
  paid: number;
  actedAt: number;
  needsAction: boolean;
};
export type Hand = {
  id: string;
  deck: number[];
  board: number[];
  seats: Seat[];
  dealer: number;
  turn: number;
  turnId: string;
  street: number;
  price: number;
  minRaise: number;
  bigBlind: number;
  deadline: number;
  done: boolean;
  result: string[];
  shown: string[];
  pot: number;
};
export type Table = {
  id: string;
  players: string[];
  dealer: number;
  hand: Hand | null;
};
export type PokerEvent = {
  id: string;
  title: string;
  status: "registration" | "running" | "paused" | "finished";
  registrationOpen: boolean;
  startingChips: number;
  seatsPerTable: number;
  smallBlind: number;
  levelMinutes: number;
  blindMultiplier?: number;
  blindMode?: "time" | "hands";
  handsPerLevel?: number;
  turnSeconds: number;
  startedAt: number;
  pausedAt: number;
  elapsedPause: number;
  round: number;
  nextRoundAt: number;
  players: Player[];
  tables: Table[];
  log: string[];
};
export type PokerState = {
  enabled: boolean;
  event: PokerEvent | null;
  receipts: { key: string; fingerprint: string }[];
};
export const emptyPoker = (): PokerState => ({
  enabled: false,
  event: null,
  receipts: [],
});
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function integer(value: unknown, min: number, max: number) {
  const n = Number(value);
  need(
    Number.isSafeInteger(n) && n >= min && n <= max,
    `Enter a whole number between ${min} and ${max}.`,
  );
  return n;
}
export function shuffle<T>(values: T[]): T[] {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const rank = (c: number) => (c % 13) + 2;
export const cardLabel = (c: number) =>
  "23456789TJQKA"[c % 13] + "♣♦♥♠"[Math.floor(c / 13)];
// Lexicographic five-card score; all 21 subsets are considered for seven cards.
export function scoreFive(cards: number[]): number[] {
  const ranks = cards.map(rank).sort((a, b) => b - a),
    unique = [...new Set(ranks)];
  const flush = cards.every(
    (c) => Math.floor(c / 13) === Math.floor(cards[0] / 13),
  );
  const straight =
    unique.length === 5 &&
    (unique[0] - unique[4] === 4
      ? unique[0]
      : unique.join() === "14,5,4,3,2"
        ? 5
        : 0);
  const counts = unique
    .map((r) => [r, ranks.filter((v) => v === r).length])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  if (flush && straight) return [8, straight];
  if (counts[0][1] === 4) return [7, counts[0][0], counts[1][0]];
  if (counts[0][1] === 3 && counts[1][1] === 2)
    return [6, counts[0][0], counts[1][0]];
  if (flush) return [5, ...ranks];
  if (straight) return [4, straight];
  if (counts[0][1] === 3) return [3, ...counts.map((v) => v[0])];
  if (counts[0][1] === 2 && counts[1][1] === 2)
    return [2, ...counts.map((v) => v[0])];
  if (counts[0][1] === 2) return [1, ...counts.map((v) => v[0])];
  return [0, ...ranks];
}
export function compare(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d;
  }
  return 0;
}
export function evaluate(cards: number[]) {
  need(cards.length >= 5 && cards.length <= 7, "Invalid showdown.");
  let best: number[] = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let f = d + 1; f < cards.length; f++) {
            const s = scoreFive([
              cards[a],
              cards[b],
              cards[c],
              cards[d],
              cards[f],
            ]);
            if (!best.length || compare(s, best) > 0) best = s;
          }
  return best;
}
const player = (e: PokerEvent, id: string) => {
  const p = e.players.find((p) => p.id === id);
  need(p, "Player not found.");
  return p;
};
const log = (e: PokerEvent, text: string) => {
  e.log = [text, ...e.log].slice(0, 60);
};
export function blinds(e: PokerEvent, now: number) {
  const elapsed = Math.max(
    0,
    ((e.status === "paused" || e.status === "finished") && e.pausedAt
      ? e.pausedAt
      : now) -
      e.startedAt -
      e.elapsedPause,
  );
  const level =
    e.blindMode === "hands"
      ? Math.floor(Math.max(0, e.round - 1) / (e.handsPerLevel ?? 10))
      : Math.floor(elapsed / (e.levelMinutes * 60000));
  return Math.round(
    e.smallBlind * (e.blindMultiplier ?? 2) ** Math.min(10, level),
  );
}
function clockwise(h: Hand, after: number, predicate: (s: Seat) => boolean) {
  for (let j = 1; j <= h.seats.length; j++) {
    const i = (after + j) % h.seats.length;
    if (predicate(h.seats[i])) return i;
  }
  return -1;
}
function pay(e: PokerEvent, s: Seat, amount: number) {
  const p = player(e, s.id),
    paid = Math.min(p.chips, amount);
  p.chips -= paid;
  s.bet += paid;
  s.paid += paid;
}
export function settle(e: PokerEvent, h: Hand) {
  const live = h.seats.filter((s) => !s.folded);
  need(live.length, "No remaining player.");
  h.done = true;
  h.deadline = 0;
  h.turn = -1;
  h.pot = h.seats.reduce((n, s) => n + s.paid, 0);
  h.result = [];
  h.shown = live.length > 1 ? live.map((s) => s.id) : [];
  const levels = [...new Set(h.seats.map((s) => s.paid).filter(Boolean))].sort(
    (a, b) => a - b,
  );
  let previous = 0;
  for (const level of levels) {
    const contributors = h.seats.filter((s) => s.paid >= level),
      amount = (level - previous) * contributors.length;
    previous = level;
    // A sole contributor receives an uncalled excess bet, even if folded.
    const eligible =
      contributors.length === 1
        ? contributors
        : contributors.filter((s) => !s.folded);
    need(eligible.length, "Invalid side pot.");
    let winners = eligible;
    if (eligible.length > 1) {
      const scores = eligible.map((s) => evaluate([...s.cards, ...h.board]));
      let best = scores[0];
      for (const s of scores) if (compare(s, best) > 0) best = s;
      winners = eligible.filter((_, i) => compare(scores[i], best) === 0);
    }
    const ordered = [];
    for (let j = 1; j <= h.seats.length; j++) {
      const s = h.seats[(h.dealer + j) % h.seats.length];
      if (winners.includes(s)) ordered.push(s);
    }
    ordered.forEach((s, i) => {
      const gain =
        Math.floor(amount / ordered.length) +
        (i < amount % ordered.length ? 1 : 0);
      player(e, s.id).chips += gain;
      h.result.push(
        `${player(e, s.id).name} ${contributors.length === 1 ? "returned" : "wins"} ${gain.toLocaleString()} chips`,
      );
    });
  }
  for (const line of h.result) log(e, line);
}
function draw(h: Hand) {
  const c = h.deck.pop();
  need(c !== undefined, "Deck exhausted.");
  return c;
}
function advance(e: PokerEvent, h: Hand, now: number) {
  const live = h.seats.filter((s) => !s.folded);
  if (live.length === 1) {
    settle(e, h);
    return;
  }
  const canAct = live.filter((s) => player(e, s.id).chips > 0);
  // A lone player with chips must still answer an outstanding bet.
  if (canAct.length <= 1 && canAct.every((s) => s.bet >= h.price)) {
    while (h.board.length < 5) {
      draw(h);
      const n = h.board.length === 0 ? 3 : 1;
      for (let j = 0; j < n; j++) h.board.push(draw(h));
    }
    settle(e, h);
    return;
  }
  const pending = (s: Seat) =>
    !s.folded &&
    player(e, s.id).chips > 0 &&
    (s.needsAction || s.bet < h.price);
  const next = clockwise(h, h.turn, pending);
  if (next >= 0) {
    h.turn = next;
    h.turnId = randomUUID();
    h.deadline = now + e.turnSeconds * 1000;
    return;
  }
  if (h.street === 3) {
    settle(e, h);
    return;
  }
  h.street++;
  draw(h);
  for (let j = 0; j < (h.street === 1 ? 3 : 1); j++) h.board.push(draw(h));
  h.price = 0;
  h.minRaise = h.bigBlind;
  for (const s of h.seats) {
    s.bet = 0;
    s.actedAt = -1;
    s.needsAction = !s.folded && player(e, s.id).chips > 0;
  }
  h.turn = h.dealer;
  advance(e, h, now);
}
function deal(e: PokerEvent, t: Table, now: number) {
  t.dealer = (t.dealer + 1) % t.players.length;
  const h: Hand = {
    id: randomUUID(),
    deck: shuffle(Array.from({ length: 52 }, (_, i) => i)),
    board: [],
    seats: t.players.map((id) => ({
      id,
      cards: [],
      folded: false,
      bet: 0,
      paid: 0,
      actedAt: -1,
      needsAction: true,
    })),
    dealer: t.dealer,
    turn: 0,
    turnId: randomUUID(),
    street: 0,
    price: blinds(e, now) * 2,
    minRaise: blinds(e, now) * 2,
    bigBlind: blinds(e, now) * 2,
    deadline: 0,
    done: false,
    result: [],
    shown: [],
    pot: 0,
  };
  for (let j = 0; j < 2; j++)
    for (let k = 1; k <= h.seats.length; k++)
      h.seats[(h.dealer + k) % h.seats.length].cards.push(draw(h));
  const small =
      h.seats.length === 2 ? h.dealer : (h.dealer + 1) % h.seats.length,
    big = (small + 1) % h.seats.length;
  pay(e, h.seats[small], blinds(e, now));
  pay(e, h.seats[big], h.price);
  h.turn = big;
  t.hand = h;
  advance(e, h, now);
}
export function play(
  e: PokerEvent,
  tableId: string,
  handId: string,
  actor: string,
  action: string,
  amount: unknown,
  now: number,
) {
  need(e.status === "running", "This tournament is not running.");
  const t = e.tables.find((t) => t.id === tableId),
    h = t?.hand;
  need(
    h && !h.done && h.id === handId,
    "This hand has changed. Refresh the table.",
  );
  const s = h.seats[h.turn];
  need(s?.id === actor, "Wait for your turn.");
  need(now < h.deadline, "Your turn expired. Refresh the table.");
  const p = player(e, actor),
    owed = Math.max(0, h.price - s.bet);
  if (action === "fold") {
    s.folded = true;
    log(e, `${p.name} folds`);
  } else if (action === "check") {
    need(owed === 0, "You must call or fold.");
    log(e, `${p.name} checks`);
  } else if (action === "call") {
    need(owed > 0, "Nothing to call.");
    pay(e, s, owed);
    log(e, `${p.name} calls`);
  } else if (action === "raise" || action === "allin") {
    const target =
      action === "allin"
        ? s.bet + p.chips
        : integer(amount, 1, e.startingChips * 90);
    if (target <= h.price) {
      need(action === "allin", "Raise must exceed the current bet.");
      pay(e, s, target - s.bet);
      log(e, `${p.name} calls all-in`);
    } else {
      need(
        s.actedAt < 0 || h.price - s.actedAt >= h.minRaise,
        "A short all-in has not reopened raising.",
      );
      need(target <= s.bet + p.chips, "Not enough chips.");
      const increase = target - h.price;
      need(
        increase >= h.minRaise || target === s.bet + p.chips,
        "Raise is below the minimum.",
      );
      pay(e, s, target - s.bet);
      if (increase >= h.minRaise) {
        h.minRaise = increase;
        for (const other of h.seats) if (other !== s) other.needsAction = true;
      }
      h.price = target;
      log(e, `${p.name} raises to ${target.toLocaleString()}`);
    }
  } else throw Error("Unknown poker action.");
  s.needsAction = false;
  s.actedAt = h.price;
  advance(e, h, now);
}
export function nextRound(e: PokerEvent, now: number) {
  const survivors = e.players.filter(
      (p) => p.status === "approved" && p.chips > 0,
    ),
    out = e.players.filter(
      (p) => p.status === "approved" && p.chips === 0 && !p.rank,
    );
  // Simultaneous bust-outs use starting stacks; equal stacks share a position.
  const starting = (id: string) =>
    e.tables.flatMap((t) => t.hand?.seats || []).find((s) => s.id === id)
      ?.paid || 0;
  out.sort((a, b) => starting(b.id) - starting(a.id));
  let position = survivors.length + 1;
  out.forEach((p, i) => {
    if (i && starting(p.id) !== starting(out[i - 1].id))
      position = survivors.length + 1 + i;
    p.rank = position;
  });
  if (survivors.length <= 1) {
    if (survivors[0]) survivors[0].rank = 1;
    e.status = "finished";
    e.pausedAt = now;
    log(e, "Tournament finished");
    return;
  }
  const count = Math.ceil(survivors.length / e.seatsPerTable),
    old = e.tables;
  // Hand-for-hand rounds allow safe balancing with no player moved during a hand.
  const liveIds = new Set(survivors.map((p) => p.id));
  const sizes = old.map(
    (t) => t.players.filter((id) => liveIds.has(id)).length,
  );
  const rebalance =
    old.length !== count ||
    Math.max(...sizes) - Math.min(...sizes) > 1 ||
    sizes.some((n) => n < 2);
  if (rebalance) {
    const ids = shuffle(survivors.map((p) => p.id));
    e.tables = Array.from({ length: count }, (_, i) => ({
      id: old[i]?.id || randomUUID(),
      players: ids.filter((_, j) => j % count === i),
      dealer: randomInt(Math.ceil(ids.length / count)),
      hand: null,
    }));
  } else
    e.tables = old.map((t) => {
      const ids = t.players.filter((id) => liveIds.has(id));
      let next = "";
      for (let j = 1; j <= t.players.length; j++) {
        const id = t.players[(t.dealer + j) % t.players.length];
        if (liveIds.has(id)) {
          next = id;
          break;
        }
      }
      return {
        id: t.id,
        players: ids,
        dealer: (ids.indexOf(next) - 1 + ids.length) % ids.length,
        hand: null,
      };
    });
  e.round++;
  e.nextRoundAt = 0;
  for (const t of e.tables) deal(e, t, now);
  log(e, `Hand ${e.round} · ${count} ${count === 1 ? "table" : "tables"}`);
}
export function tick(e: PokerEvent, now: number) {
  if (e.status !== "running") return;
  for (const t of e.tables) {
    const h = t.hand;
    if (h && !h.done && now >= h.deadline) {
      const s = h.seats[h.turn];
      s.folded = s.bet < h.price;
      s.needsAction = false;
      s.actedAt = h.price;
      log(
        e,
        `${player(e, s.id).name} timed out: ${s.folded ? "fold" : "check"}`,
      );
      advance(e, h, now);
    }
  }
  if (e.tables.every((t) => t.hand?.done)) {
    if (!e.nextRoundAt) e.nextRoundAt = now + 6500;
    else if (now >= e.nextRoundAt) nextRound(e, now);
  }
}
export function createEvent(body: Record<string, unknown>): PokerEvent {
  const title = String(body.title || "Trash Poker Night").trim();
  need(
    title.length > 0 && title.length <= 70,
    "Use a title up to 70 characters.",
  );
  const blindMode = body.blindMode ?? "time";
  need(
    blindMode === "time" || blindMode === "hands",
    "Choose time or hands for blind levels.",
  );
  const blindMultiplier = Number(body.blindMultiplier ?? 2);
  need([1.5, 2, 3].includes(blindMultiplier), "Choose a valid blind increase.");
  return {
    id: randomUUID(),
    title,
    blindMultiplier,
    blindMode,
    handsPerLevel: integer(body.handsPerLevel ?? 10, 1, 100),
    status: "registration",
    registrationOpen: true,
    startingChips: integer(body.startingChips ?? 10000, 100, 1000000),
    seatsPerTable: integer(body.seatsPerTable ?? 9, 2, 9),
    smallBlind: integer(body.smallBlind ?? 25, 1, 10000),
    levelMinutes: integer(body.levelMinutes ?? 10, 1, 60),
    turnSeconds: integer(body.turnSeconds ?? 30, 15, 90),
    startedAt: 0,
    pausedAt: 0,
    elapsedPause: 0,
    round: 0,
    nextRoundAt: 0,
    players: [],
    tables: [],
    log: [],
  };
}
export function command(
  state: PokerState,
  body: Record<string, unknown>,
  actor: { id: string; name: string },
  admin: boolean,
  now: number,
) {
  const action = String(body.action);
  if (action === "enabled") {
    need(admin, "AUTH: Admin access required.");
    state.enabled = body.enabled === true;
    return;
  }
  if (action === "create") {
    need(admin, "AUTH: Admin access required.");
    need(
      !state.event || state.event.status === "finished",
      "Finish the current tournament first.",
    );
    state.event = createEvent(body);
    return;
  }
  const e = state.event;
  need(e, "No poker night has been created.");
  if (action === "tick") {
    tick(e, now);
    return;
  }
  if (action === "join") {
    need(
      state.enabled && e.status === "registration" && e.registrationOpen,
      "Registration is closed.",
    );
    need(e.players.length < 90, "This event is full.");
    need(
      !e.players.some((p) => p.id === actor.id),
      "You are already signed up.",
    );
    e.players.push({ ...actor, status: "pending", chips: 0 });
    return;
  }
  if (action === "leave") {
    need(e.status === "registration", "Registration has ended.");
    e.players = e.players.filter((p) => p.id !== actor.id);
    return;
  }
  if (["fold", "check", "call", "raise", "allin"].includes(action)) {
    play(
      e,
      String(body.tableId),
      String(body.handId),
      actor.id,
      action,
      body.amount,
      now,
    );
    return;
  }
  need(admin, "AUTH: Admin access required.");
  if (action === "registration") {
    need(e.status === "registration", "This event has started.");
    e.registrationOpen = body.open === true;
  } else if (action === "approve" || action === "remove" || action === "add") {
    need(
      e.status === "registration",
      "Players cannot change after the tournament starts.",
    );
    const id = String(body.playerId);
    if (action === "remove") e.players = e.players.filter((p) => p.id !== id);
    else if (action === "approve") player(e, id).status = "approved";
    else {
      need(e.players.length < 90, "This event is full.");
      need(!e.players.some((p) => p.id === id), "Player already signed up.");
      e.players.push({
        id,
        name: String(body.playerName),
        status: "approved",
        chips: 0,
      });
    }
  } else if (action === "settings") {
    need(
      e.status === "registration",
      "Poker settings lock when the tournament starts.",
    );
    const next = createEvent({ ...e, ...body });
    Object.assign(e, {
      title: next.title,
      startingChips: next.startingChips,
      seatsPerTable: next.seatsPerTable,
      smallBlind: next.smallBlind,
      levelMinutes: next.levelMinutes,
      blindMultiplier: next.blindMultiplier,
      blindMode: next.blindMode,
      handsPerLevel: next.handsPerLevel,
      turnSeconds: next.turnSeconds,
    });
    log(e, "Poker settings updated");
  } else if (action === "start") {
    need(e.status === "registration", "Already started.");
    need(
      e.players.filter((p) => p.status === "approved").length >= 2,
      "Approve at least two players.",
    );
    e.registrationOpen = false;
    for (const p of e.players)
      if (p.status === "approved") p.chips = e.startingChips;
    e.status = "running";
    e.startedAt = now;
    nextRound(e, now);
  } else if (action === "pause") {
    need(e.status === "running", "Event is not running.");
    e.status = "paused";
    e.pausedAt = now;
    log(e, "Admin paused play");
  } else if (action === "resume") {
    need(e.status === "paused", "Event is not paused.");
    const delay = now - e.pausedAt;
    e.elapsedPause += delay;
    for (const t of e.tables)
      if (t.hand && !t.hand.done) t.hand.deadline += delay;
    if (e.nextRoundAt) e.nextRoundAt += delay;
    e.status = "running";
    log(e, "Play resumed");
  } else if (action === "end") {
    need(e.status !== "finished", "Already finished.");
    if (e.status === "paused") e.elapsedPause += now - e.pausedAt;
    for (const table of e.tables) {
      const h = table.hand;
      if (h && !h.done) {
        for (const s of h.seats) player(e, s.id).chips += s.paid;
        h.done = true;
        h.turn = -1;
        h.deadline = 0;
        h.pot = 0;
        h.shown = [];
        h.result = ["Hand cancelled · committed chips returned"];
      }
    }
    e.status = "finished";
    e.pausedAt = now;
    e.registrationOpen = false;
    log(e, "Tournament ended by admin");
  } else throw Error("Unknown poker command.");
}
export function project(
  state: PokerState,
  actorId: string,
  admin: boolean,
  now: number,
) {
  const e = state.event;
  return {
    enabled: state.enabled,
    admin,
    viewerId: actorId,
    serverTime: now,
    event: !e
      ? null
      : {
          id: e.id,
          title: e.title,
          status: e.status,
          registrationOpen: e.registrationOpen,
          startingChips: e.startingChips,
          seatsPerTable: e.seatsPerTable,
          smallBlind: e.smallBlind,
          levelMinutes: e.levelMinutes,
          blindMultiplier: e.blindMultiplier ?? 2,
          blindMode: e.blindMode ?? "time",
          handsPerLevel: e.handsPerLevel ?? 10,
          turnSeconds: e.turnSeconds,
          round: e.round,
          nextRoundAt: e.nextRoundAt,
          blind: e.startedAt ? blinds(e, now) : e.smallBlind,
          players: e.players
            .filter((p) => admin || p.status === "approved" || p.id === actorId)
            .map((p) => ({ ...p })),
          pendingCount: e.players.filter((p) => p.status === "pending").length,
          log: e.log,
          tables: e.tables.map((t) => ({
            id: t.id,
            players: t.players,
            hand: !t.hand
              ? null
              : {
                  id: t.hand.id,
                  board: t.hand.board,
                  dealer: t.hand.dealer,
                  turn: t.hand.turn,
                  turnId: t.hand.turnId,
                  street: t.hand.street,
                  price: t.hand.price,
                  minRaise: t.hand.minRaise,
                  deadline: t.hand.deadline,
                  done: t.hand.done,
                  result: t.hand.result,
                  pot: t.hand.done
                    ? t.hand.pot
                    : t.hand.seats.reduce((n, s) => n + s.paid, 0),
                  seats: t.hand.seats.map((s) => ({
                    id: s.id,
                    folded: s.folded,
                    bet: s.bet,
                    paid: s.paid,
                    canRaise:
                      s.actedAt < 0 ||
                      t.hand!.price - s.actedAt >= t.hand!.minRaise,
                    cards:
                      s.id === actorId ||
                      (t.hand!.done && t.hand!.shown.includes(s.id))
                        ? s.cards
                        : [],
                  })),
                },
          })),
        },
  };
}
export type PokerView = ReturnType<typeof project> & { version: number };
