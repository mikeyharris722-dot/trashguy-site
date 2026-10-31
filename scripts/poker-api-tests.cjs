const fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (n) => (Object.hasOwn(mocks, n) ? mocks[n] : require(n)),
      Response,
      Request,
      URL,
      Headers,
      structuredClone,
      AbortSignal,
      process,
      Buffer,
      console,
    },
  );
  return exports;
}
const g = load("lib/poker-engine.ts");
let record = { state: g.emptyPoker(), version: 0 },
  actor = null,
  admin = false,
  saves = 0;
const api = load("app/api/poker/route.ts", {
  "@/lib/site-db": {
    apiError: (e) =>
      Response.json(
        { error: e.message },
        { status: e.message.startsWith("AUTH:") ? 403 : 400 },
      ),
    requireTrackerAdmin: async () => {
      if (!admin) throw Error("AUTH: admin");
    },
  },
  "@/lib/poker-auth": {
    pokerActor: async (request) =>
      request.headers.get("x-test-actor")
        ? { id: request.headers.get("x-test-actor"), name: "Test player" }
        : actor,
    registeredPokerPlayer: async (id) => {
      assert.equal(id, "registered-profile");
      return {
        playerId: "profile:registered-profile",
        playerName: "Verified player",
      };
    },
  },
  "@/lib/poker-engine": g,
  "@/lib/poker-store": {
    readPoker: async () => structuredClone(record),
    savePoker: async (state, v) => {
      if (v !== record.version) return false;
      record = { state, version: v + 1 };
      saves++;
      return true;
    },
  },
});
const req = (body) =>
  new Request("https://example.test/api/poker", {
    method: "POST",
    body: JSON.stringify(body),
  });
const send = (action, extra = {}) =>
  api.POST(
    req({
      action,
      version: record.version,
      eventId: record.state.event?.id,
      requestId: require("node:crypto").randomUUID(),
      ...extra,
    }),
  );
(async () => {
  assert.equal((await send("create")).status, 403);
  actor = { id: "p0", name: "Real player" };
  assert.equal((await send("create")).status, 403);
  admin = true;
  assert.equal((await send("enabled", { enabled: true })).status, 200);
  assert.equal((await send("create")).status, 200);
  admin = false;
  const body = {
    action: "join",
    version: record.version,
    eventId: record.state.event.id,
    requestId: require("node:crypto").randomUUID(),
    playerId: "attacker",
    playerName: "Spoofed",
  };
  assert.equal((await api.POST(req(body))).status, 200);
  assert.equal(record.state.event.players[0].id, "p0");
  const saved = saves;
  assert.equal((await api.POST(req(body))).status, 200);
  assert.equal(saves, saved);
  assert.equal(
    (await api.POST(req({ ...body, playerName: "Different" }))).status,
    400,
  );
  assert.equal((await send("approve", { playerId: "p0" })).status, 403);
  assert.equal((await send("join", { version: 0 })).status, 409);
  admin = true;
  await send("approve", { playerId: "p0" });
  await send("add", { profileId: "registered-profile", playerName: "Fake" });
  assert.equal(record.state.event.players[1].name, "Verified player");
  await send("start");
  admin = false;
  actor = null;
  const publicView = await (
    await api.GET(new Request("https://example.test/api/poker"))
  ).json();
  assert.equal(
    publicView.event.tables[0].hand.seats.flatMap((s) => s.cards).length,
    0,
  );
  assert.equal("deck" in publicView.event.tables[0].hand, false);
  assert.equal("receipts" in publicView, false);
  actor = { id: "p0", name: "Real player" };
  const own = await (
    await api.GET(new Request("https://example.test/api/poker"))
  ).json();
  assert.equal(
    own.event.tables[0].hand.seats.find((s) => s.id === "p0").cards.length,
    2,
  );
  assert.equal((await send("end")).status, 403);
  assert.equal((await send("tick", { eventId: "wrong" })).status, 409);
  // Concurrent commands from one head cannot overwrite each other.
  admin = true;
  const v = record.version;
  const results = await Promise.all([
    send("pause", { version: v }),
    send("pause", { version: v }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  console.log(
    "PASS poker API authentication, admin authorization, identity, idempotency, private projection, stale event and concurrent writes",
  );
  const multi = g.createEvent({ startingChips: 1000, seatsPerTable: 2 });
  multi.status = "running";
  multi.startedAt = Date.now();
  for (let i = 0; i < 4; i++)
    multi.players.push({
      id: "multi" + i,
      name: "Player" + i,
      status: "approved",
      chips: 1000,
    });
  g.nextRound(multi, Date.now());
  record = {
    state: { enabled: true, event: multi, receipts: [] },
    version: record.version + 1,
  };
  const multiVersion = record.version;
  const requests = multi.tables.map((t) => {
    const h = t.hand,
      s = h.seats[h.turn];
    return new Request("https://example.test/api/poker", {
      method: "POST",
      headers: { "x-test-actor": s.id },
      body: JSON.stringify({
        action: s.bet < h.price ? "call" : "check",
        eventId: multi.id,
        tableId: t.id,
        handId: h.id,
        turnId: h.turnId,
        version: multiVersion,
        requestId: require("node:crypto").randomUUID(),
      }),
    });
  });
  assert.deepEqual(
    (await Promise.all(requests.map((r) => api.POST(r)))).map((r) => r.status),
    [200, 200],
  );
  const stale = multi.tables[0],
    oldHand = stale.hand;
  const staleRequest = new Request("https://example.test/api/poker", {
    method: "POST",
    headers: { "x-test-actor": oldHand.seats[oldHand.turn].id },
    body: JSON.stringify({
      action: "fold",
      eventId: multi.id,
      tableId: stale.id,
      handId: oldHand.id,
      turnId: oldHand.turnId,
      version: multiVersion,
      requestId: require("node:crypto").randomUUID(),
    }),
  });
  assert.equal((await api.POST(staleRequest)).status, 409);
  console.log(
    "PASS independent tables accept concurrent actions while stale turn tokens are rejected",
  );
  let authCalls = 0;
  const identity = {
    provider: "twitch",
    identity_data: { provider_id: "123456", preferred_username: "real_login" },
  };
  const user = {
    id: "auth-user",
    identities: [identity],
    user_metadata: { preferred_username: "spoofed_admin" },
  };
  const authDb = {
    auth: {
      getUser: async () => {
        authCalls++;
        return { data: { user }, error: null };
      },
    },
    from: () => ({
      select() {
        return this;
      },
      or() {
        return this;
      },
      limit: async () => ({
        data: [
          { id: "profile-1", username: "real_login", twitch_user_id: "123456" },
        ],
        error: null,
      }),
    }),
  };
  const authHelper = load("lib/poker-auth.ts", {
    "server-only": {},
    "./site-db": { siteDb: () => authDb },
  });
  const token =
    "test." +
    Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 300 }),
    ).toString("base64url") +
    ".test";
  const authReq = new Request("https://example.test/api/poker", {
    headers: { authorization: "Bearer " + token },
  });
  assert.equal(
    (await authHelper.pokerActor(authReq, true)).id,
    "profile:profile-1",
  );
  assert.equal((await authHelper.pokerActor(authReq, true)).name, "real_login");
  assert.equal(authCalls, 1);
  await authHelper.pokerActor(authReq);
  assert.equal(authCalls, 2);
  user.identities = [];
  await assert.rejects(() => authHelper.pokerActor(authReq), /Twitch/);
  console.log(
    "PASS validated Twitch identity ignores editable metadata; only reads reuse identity cache and commands always revalidate",
  );
  const store = load("lib/poker-store.ts", {
    "server-only": {},
    "./site-db": {
      siteDb: () => {
        throw Error("Remote DB must not be touched by local tests");
      },
    },
    "./poker-engine": g,
  });
  const previous = process.env.POKER_LOCAL,
    oldNode = process.env.NODE_ENV;
  process.env.POKER_LOCAL = "1";
  process.env.NODE_ENV = "test";
  const path = require("node:path"),
    file = path.join(process.cwd(), ".local", "poker-state.json");
  let original;
  try {
    original = fs.readFileSync(file);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ state: g.emptyPoker(), version: 0 }),
    );
    const writes = await Promise.all([
      store.savePoker({ ...g.emptyPoker(), enabled: true }, 0),
      store.savePoker(g.emptyPoker(), 0),
    ]);
    assert.equal(writes.filter(Boolean).length, 1);
    assert.equal((await store.readPoker()).version, 1);
    console.log("PASS real local-store compare-and-swap prevents lost updates");
  } finally {
    if (original) fs.writeFileSync(file, original);
    else fs.unlinkSync(file);
    if (previous === undefined) delete process.env.POKER_LOCAL;
    else process.env.POKER_LOCAL = previous;
    if (oldNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNode;
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
