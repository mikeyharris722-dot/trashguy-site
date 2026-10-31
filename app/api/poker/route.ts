import { createHash } from "node:crypto";
import { apiError, requireTrackerAdmin } from "@/lib/site-db";
import { pokerActor, registeredPokerPlayer } from "@/lib/poker-auth";
import { command, project } from "@/lib/poker-engine";
import { readPoker, savePoker } from "@/lib/poker-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function isAdmin(request: Request) {
  try {
    await requireTrackerAdmin(request);
    return true;
  } catch {
    return false;
  }
}
let readCache:
  { until: number; value: Awaited<ReturnType<typeof readPoker>> } | undefined;
let reading: Promise<Awaited<ReturnType<typeof readPoker>>> | undefined;
async function pollState() {
  if (readCache && readCache.until > Date.now())
    return structuredClone(readCache.value);
  reading ||= readPoker()
    .then((value) => {
      readCache = { until: Date.now() + 750, value };
      return value;
    })
    .finally(() => {
      reading = undefined;
    });
  return structuredClone(await reading);
}
export async function GET(request: Request) {
  try {
    const actor = await pokerActor(request, true),
      admin =
        actor && new URL(request.url).searchParams.get("admin") === "1"
          ? await isAdmin(request)
          : false,
      { state, version } = await pollState();
    return json({
      ...project(state, actor?.id || "", admin, Date.now()),
      version,
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 12000)
      return json({ error: "Request too large." }, 413);
    const raw = await request.text();
    if (raw.length > 12000) return json({ error: "Request too large." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const actor = await pokerActor(request);
    if (!actor) throw Error("AUTH: Sign in with Twitch first.");
    const action = String(body.action),
      adminActions = [
        "enabled",
        "create",
        "settings",
        "registration",
        "approve",
        "remove",
        "add",
        "start",
        "pause",
        "resume",
        "end",
      ];
    const admin = adminActions.includes(action)
      ? await isAdmin(request)
      : false;
    if (adminActions.includes(action) && !admin)
      throw Error("AUTH: Admin access required.");
    const requestId = String(body.requestId || "");
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw Error("Invalid request ID.");
    const key = actor.id + ":" + requestId,
      fingerprint = createHash("sha256")
        .update(JSON.stringify(body))
        .digest("hex");
    const playing = ["fold", "check", "call", "raise", "allin"].includes(
      action,
    );
    if (action === "add")
      Object.assign(body, await registeredPokerPlayer(body.profileId));
    for (let attempt = 0; attempt < 3; attempt++) {
      const { state, version } = await readPoker();
      const receipt = state.receipts.find((r) => r.key === key);
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw Error("Request ID already used.");
        return json({ ok: true, version });
      }
      if (!playing && action !== "tick" && Number(body.version) !== version)
        return json(
          { error: "The event changed. Refresh and try again." },
          409,
        );
      if (
        body.eventId !== state.event?.id &&
        action !== "create" &&
        action !== "enabled"
      )
        return json(
          { error: "This poker night has changed. Refresh the page." },
          409,
        );
      // A per-turn token lets independent tables play concurrently without accepting stale clicks.
      if (playing) {
        const h = state.event?.tables.find((t) => t.id === body.tableId)?.hand;
        if (!h || h.turnId !== body.turnId)
          return json(
            { error: "This turn has changed. Refresh the table." },
            409,
          );
      }
      const before = JSON.stringify(state);
      command(state, body, actor, admin, Date.now());
      if (action === "tick" && JSON.stringify(state) === before)
        return json({ ok: true, version });
      state.receipts = [...state.receipts, { key, fingerprint }].slice(-256);
      if (await savePoker(state, version)) {
        readCache = undefined;
        return json({ ok: true, version: version + 1 });
      }
      if (!playing && action !== "tick") break;
    }
    return json(
      { error: "Another action just arrived. Refresh and try again." },
      409,
    );
  } catch (e) {
    return apiError(e);
  }
}
