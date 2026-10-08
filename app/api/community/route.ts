import {
  communityState,
  communityTracker,
  communityCommand,
  rainbetGames,
} from "@/lib/community-local";
import { communityJson } from "@/lib/community-request";
import { localCommunity } from "@/lib/community-store";
import { siteDb, requireTrackerAdmin, apiError } from "@/lib/site-db";
async function actor(request: Request) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const { data, error } = await siteDb().auth.getUser(token);
  if (error || !data.user) throw Error("AUTH: Sign in with Twitch to join.");
  const identity = data.user.identities?.find((i) => i.provider === "twitch");
  if (!identity) throw Error("AUTH: Sign in with Twitch to join.");
  const name = String(
    identity?.identity_data?.preferred_username ||
      identity?.identity_data?.name ||
      "Viewer",
  );
  return { id: data.user.id, name };
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.has("q"))
      return Response.json({
        games: await rainbetGames(url.searchParams.get("q") || ""),
      });
    const s = await communityState();
    let who: null | { id: string; name: string } = null,
      admin = false;
    if (request.headers.get("authorization")) {
      try {
        who = await actor(request);
        await requireTrackerAdmin(request);
        admin = true;
      } catch {}
    }
    const hunts = s.hunts
      .filter((h) => !h.deleted)
      .map((h) => ({
        ...communityTracker(h),
        entries: admin
          ? communityTracker(h).entries
          : communityTracker(h).entries.map((entry) => ({
              ...entry,
              notes: "",
            })),
        limit: h.limit,
        predictionPrize: h.predictionPrize ?? 15,
        predictions: (h.predictions || []).map((p) => ({ username: p.username, amount: p.amount, createdAt: p.createdAt, mine: p.userId === who?.id })),
        calls: h.calls.filter((c) => c.status !== "withdrawn"),
        members: h.members
          .filter((m) => admin || m.status === "accepted" || m.id === who?.id)
          .map((m) =>
            admin || m.id === who?.id
              ? m
              : { id: m.id, name: m.name, status: m.status, amount: null },
          ),
      }));
    return Response.json(
      { hunts, activeHuntId: s.activeHuntId, localTest: localCommunity() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const who = await actor(request);
    let admin = false;
    try {
      await requireTrackerAdmin(request);
      admin = true;
    } catch {}
    const b = await communityJson(request);
    const result = await communityCommand(who, admin, b);
    return Response.json({ ok: true, result });
  } catch (e) {
    return apiError(e);
  }
}
