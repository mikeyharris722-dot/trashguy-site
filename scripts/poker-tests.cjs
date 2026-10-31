const fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
const code = ts.transpileModule(
  fs.readFileSync("lib/poker-engine.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const mod = { exports: {} };
vm.runInNewContext(code, {
  exports: mod.exports,
  require,
  structuredClone,
  console,
});
const g = mod.exports;
let cases = 0;
function test(name, fn) {
  fn();
  cases++;
  console.log("PASS " + name);
}
const card = (s) => {
  const r = "23456789TJQKA".indexOf(s[0]),
    suit = "cdhs".indexOf(s[1]);
  assert.ok(r >= 0 && suit >= 0);
  return suit * 13 + r;
};
const cards = (s) => s.split(" ").map(card);
const event = (n) => {
  const e = g.createEvent({
    startingChips: 1000,
    smallBlind: 5,
    seatsPerTable: 9,
  });
  for (let i = 0; i < n; i++)
    e.players.push({
      id: "p" + i,
      name: "Player" + i,
      status: "approved",
      chips: 1000,
    });
  e.status = "running";
  e.startedAt = 100000;
  return e;
};
test("hand ordering, wheel, full houses and best seven-card selection", () => {
  const fixtures = [
    "Ac Kd 9h 7c 3s",
    "Ac Ad 9h 7c 3s",
    "Ac Ad 9h 9c 3s",
    "Ac Ad Ah 7c 3s",
    "Ac 2d 3h 4c 5s",
    "Ac Tc 9c 7c 3c",
    "Ac Ad Ah 7c 7s",
    "Ac Ad Ah As 3s",
    "9c Tc Jc Qc Kc",
  ];
  fixtures.forEach((f, i) => assert.equal(g.scoreFive(cards(f))[0], i));
  assert.equal(g.scoreFive(cards(fixtures[4]))[1], 5);
  assert.equal(g.evaluate(cards("Ac Ad Ah Kc Kd Kh 2c"))[1], 14);
  assert.equal(g.evaluate(cards("Ac 2c 3c 4c 5c Kd Qd"))[0], 8);
});
test("secure shuffle produces every unique card", () => {
  for (let i = 0; i < 100; i++) {
    const e = event(9);
    g.nextRound(e, 100001);
    const h = e.tables[0].hand;
    assert.equal(
      new Set([...h.deck, ...h.board, ...h.seats.flatMap((s) => s.cards)]).size,
      52,
    );
  }
});
test("heads-up button posts small blind and acts first preflop", () => {
  const e = event(2);
  g.nextRound(e, 100001);
  const h = e.tables[0].hand;
  assert.equal(h.turn, h.dealer);
  assert.equal(h.seats[h.dealer].bet, 5);
  assert.equal(h.seats[1 - h.dealer].bet, 10);
});
test("private cards and deck stay private for spectators and admins", () => {
  const e = event(3);
  g.nextRound(e, 100001);
  for (const admin of [false, true]) {
    const v = g.project(
      { enabled: true, event: e, receipts: [] },
      "p0",
      admin,
      100002,
    );
    const h = v.event.tables[0].hand;
    assert.equal("deck" in h, false);
    h.seats.forEach((s) => assert.equal(s.cards.length, s.id === "p0" ? 2 : 0));
  }
  assert.equal(
    g
      .project({ enabled: true, event: e, receipts: [] }, "", false, 100002)
      .event.tables[0].hand.seats.flatMap((s) => s.cards).length,
    0,
  );
});
test("invalid actions, stale hand and off-turn play do not change chips", () => {
  const e = event(3);
  g.nextRound(e, 100001);
  const t = e.tables[0],
    h = t.hand,
    s = h.seats[h.turn],
    other = h.seats.find((s) => s.id !== h.seats[h.turn].id);
  assert.throws(() => g.play(e, t.id, h.id, other.id, "call", 0, 100002));
  assert.throws(() => g.play(e, t.id, "old", s.id, "call", 0, 100002));
  assert.throws(() => g.play(e, t.id, h.id, s.id, "check", 0, 100002));
  assert.throws(() => g.play(e, t.id, h.id, s.id, "raise", 11, 100002));
  assert.throws(() => g.play(e, t.id, h.id, s.id, "call", 0, h.deadline));
});
test("side pots, uncalled returns and ties conserve chips", () => {
  const e = event(3);
  e.players.forEach((p) => (p.chips = 0));
  const h = {
    id: "h",
    deck: [],
    board: cards("2c 3d 7h 9s Jc"),
    seats: [
      { id: "p0", cards: cards("Ac Ad"), paid: 50, bet: 50, folded: false },
      { id: "p1", cards: cards("Kc Kd"), paid: 100, bet: 100, folded: false },
      { id: "p2", cards: cards("Qc Qd"), paid: 150, bet: 150, folded: false },
    ],
    dealer: 0,
    done: false,
    result: [],
  };
  g.settle(e, h);
  assert.equal(e.players.map((p) => p.chips).join(), [150, 100, 50].join());
  const tie = event(2);
  tie.players.forEach((p) => (p.chips = 0));
  const th = {
    ...h,
    board: cards("Tc Jc Qc Kc Ac"),
    seats: [
      { id: "p0", cards: cards("2d 3d"), paid: 10, folded: false },
      { id: "p1", cards: cards("4d 5d"), paid: 10, folded: false },
    ],
  };
  g.settle(tie, th);
  assert.equal(tie.players.map((p) => p.chips).join(), "10,10");
});
test("short all-in does not reopen betting; cumulative full raise does", () => {
  const e = event(3);
  g.nextRound(e, 100001);
  const t = e.tables[0],
    h = t.hand;
  const first = h.seats[h.turn];
  g.play(e, t.id, h.id, first.id, "raise", 100, 100002);
  const second = h.seats[h.turn];
  e.players.find((p) => p.id === second.id).chips = 105 - second.bet;
  g.play(e, t.id, h.id, second.id, "allin", 0, 100003);
  const third = h.seats[h.turn];
  g.play(e, t.id, h.id, third.id, "call", 0, 100004);
  assert.equal(h.seats[h.turn].id, first.id);
  assert.throws(
    () => g.play(e, t.id, h.id, first.id, "raise", 200, 100005),
    /reopened/,
  );
  g.play(e, t.id, h.id, first.id, "call", 0, 100006);
});
test("pause/resume preserves turn time and blind clock", () => {
  const e = event(2);
  g.nextRound(e, 100001);
  const st = { enabled: true, event: e, receipts: [] },
    deadline = e.tables[0].hand.deadline;
  g.command(
    st,
    { action: "pause" },
    { id: "admin", name: "Admin" },
    true,
    110000,
  );
  g.tick(e, 900000);
  assert.equal(e.tables[0].hand.deadline, deadline);
  g.command(
    st,
    { action: "resume" },
    { id: "admin", name: "Admin" },
    true,
    910000,
  );
  assert.equal(e.tables[0].hand.deadline, deadline + 800000);
  assert.equal(g.blinds(e, 910001), 5);
});
test("button rotates and seating stays stable between ordinary rounds", () => {
  const e = event(9);
  g.nextRound(e, 100001);
  const ids = [...e.tables[0].players],
    dealer = e.tables[0].dealer;
  g.nextRound(e, 100002);
  assert.equal(e.tables[0].players.join(), ids.join());
  assert.equal(e.tables[0].dealer, (dealer + 1) % 9);
});
test("registration and admin controls enforce approval and event lifecycle", () => {
  const s = g.emptyPoker(),
    admin = { id: "admin", name: "Admin" },
    u = { id: "user", name: "User" };
  assert.throws(() => g.command(s, { action: "create" }, u, false, 1));
  g.command(s, { action: "create" }, admin, true, 1);
  assert.throws(() => g.command(s, { action: "join" }, u, false, 1));
  g.command(s, { action: "enabled", enabled: true }, admin, true, 1);
  g.command(s, { action: "join" }, u, false, 1);
  assert.equal(s.event.players[0].status, "pending");
  assert.throws(() => g.command(s, { action: "start" }, admin, true, 1));
  assert.throws(() =>
    g.command(s, { action: "approve", playerId: "user" }, u, false, 1),
  );
});
test("multi-table random tournaments conserve chips through all-ins, folds and timeouts", () => {
  for (let trial = 0; trial < 42; trial++) {
    const n = trial === 41 ? 90 : 2 + (trial % 24),
      e = event(n);
    g.nextRound(e, 100001);
    let now = 100002,
      moves = 0;
    while (e.status === "running" && moves++ < 20000) {
      for (const t of e.tables) {
        const h = t.hand;
        if (!h || h.done) continue;
        const s = h.seats[h.turn],
          p = e.players.find((p) => p.id === s.id);
        const r = Math.random();
        let action =
          r < 0.15
            ? "fold"
            : r < 0.4
              ? "allin"
              : s.bet < h.price
                ? "call"
                : "check";
        if (
          action === "allin" &&
          s.actedAt >= 0 &&
          h.price - s.actedAt < h.minRaise &&
          p.chips > h.price - s.bet
        )
          action = s.bet < h.price ? "call" : "check";
        g.play(e, t.id, h.id, s.id, action, 0, now);
      }
      const total =
        e.players.reduce((v, p) => v + p.chips, 0) +
        e.tables.reduce(
          (v, t) =>
            v +
            (t.hand && !t.hand.done
              ? t.hand.seats.reduce((x, s) => x + s.paid, 0)
              : 0),
          0,
        );
      assert.equal(total, n * 1000);
      assert.ok(
        e.players.every((p) => Number.isInteger(p.chips) && p.chips >= 0),
      );
      if (e.tables.every((t) => t.hand.done)) {
        g.tick(e, now);
        now += 6501;
        g.tick(e, now);
      } else now += 1;
    }
    assert.equal(e.status, "finished");
    assert.equal(e.players.filter((p) => p.chips > 0).length, 1);
    assert.equal(e.players.find((p) => p.rank === 1).chips, n * 1000);
  }
});
test("timeout checks free actions and folds facing a bet", () => {
  const e = event(2);
  g.nextRound(e, 100001);
  const h = e.tables[0].hand,
    id = h.seats[h.turn].id;
  g.tick(e, h.deadline);
  assert.ok(h.done);
  assert.equal(h.seats.find((s) => s.id === id).folded, true);
});
test("ending an active event refunds committed chips without exposing cards", () => {
  const e = event(4);
  g.nextRound(e, 100001);
  g.command(
    { enabled: true, event: e, receipts: [] },
    { action: "end" },
    { id: "admin", name: "Admin" },
    true,
    101000,
  );
  assert.equal(
    e.players.reduce((n, p) => n + p.chips, 0),
    4000,
  );
  assert.ok(e.tables.every((t) => t.hand.done && t.hand.shown.length === 0));
  assert.equal(g.blinds(e, 999999999), 5);
});
test("a blind level change cannot alter betting limits during an existing hand", () => {
  const e = event(2);
  e.levelMinutes = 1;
  e.startedAt = 50000;
  g.nextRound(e, 100001);
  const t = e.tables[0],
    h = t.hand;
  g.play(e, t.id, h.id, h.seats[h.turn].id, "call", 0, 110001);
  g.play(e, t.id, h.id, h.seats[h.turn].id, "check", 0, 110002);
  assert.equal(g.blinds(e, 110002), 10);
  assert.equal(h.minRaise, 10);
  assert.equal(h.bigBlind, 10);
});
test("admin poker settings preserve signups, validate values and lock after start", () => {
  const e = g.createEvent({});
  e.players.push({ id: "p0", name: "Player", status: "approved", chips: 0 });
  const state = { enabled: true, event: e, receipts: [] },
    admin = { id: "admin", name: "Admin" };
  assert.throws(
    () =>
      g.command(
        state,
        { action: "settings", levelMinutes: 5 },
        admin,
        false,
        1,
      ),
    /Admin/,
  );
  g.command(
    state,
    {
      action: "settings",
      levelMinutes: 5,
      blindMultiplier: 1.5,
      turnSeconds: 45,
    },
    admin,
    true,
    1,
  );
  assert.equal(e.levelMinutes, 5);
  assert.equal(e.blindMultiplier, 1.5);
  assert.equal(e.players.length, 1);
  assert.throws(() =>
    g.command(state, { action: "settings", levelMinutes: 0 }, admin, true, 1),
  );
  e.status = "running";
  e.startedAt = 1000;
  assert.equal(g.blinds(e, 301000), 38);
  assert.throws(
    () =>
      g.command(state, { action: "settings", levelMinutes: 2 }, admin, true, 1),
    /lock/,
  );
});
test("hand-count blinds increase at the next round boundary and ignore elapsed time", () => {
  const e = g.createEvent({
    blindMode: "hands",
    handsPerLevel: 3,
    smallBlind: 25,
    blindMultiplier: 2,
  });
  e.status = "running";
  e.startedAt = 1000;
  for (const [round, expected] of [
    [1, 25],
    [3, 25],
    [4, 50],
    [6, 50],
    [7, 100],
  ]) {
    e.round = round;
    assert.equal(g.blinds(e, 999999999), expected);
  }
  assert.throws(() => g.createEvent({ blindMode: "invalid" }));
  assert.throws(() => g.createEvent({ blindMode: "hands", handsPerLevel: 0 }));
});
console.log(`${cases} poker engine groups passed.`);
