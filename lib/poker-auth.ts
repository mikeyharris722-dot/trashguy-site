import "server-only";
import { createHash } from "node:crypto";
import { siteDb } from "./site-db";
type Actor = { id: string; name: string };
const actorReads = new Map<string, { actor: Actor; until: number }>();
export async function pokerActor(
  request: Request,
  readOnly = false,
): Promise<Actor | null> {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;
  const key = createHash("sha256").update(token).digest("hex"),
    cached = actorReads.get(key);
  if (readOnly && cached && cached.until > Date.now()) return cached.actor;
  const actor = await validatedActor(request);
  // Read-only polling may reuse a recently validated identity. Every command revalidates.
  const expiry = (() => {
    try {
      return (
        Number(
          JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
            .exp,
        ) * 1000
      );
    } catch {
      return 0;
    }
  })();
  if (actor && expiry > Date.now()) {
    if (actorReads.size >= 256)
      actorReads.delete(actorReads.keys().next().value!);
    actorReads.set(key, { actor, until: Math.min(expiry, Date.now() + 20000) });
  }
  return actor;
}
async function validatedActor(request: Request): Promise<Actor | null> {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;
  const db = siteDb(),
    { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw Error("AUTH: Please sign in again.");
  const identity = data.user.identities?.find((i) => i.provider === "twitch"),
    info = identity?.identity_data;
  const twitchId = String(info?.provider_id || info?.sub || ""),
    name = String(info?.preferred_username || info?.name || "").toLowerCase();
  if (!/^\d+$/.test(twitchId) || !name)
    throw Error("AUTH: Sign in with Twitch to play poker.");
  const { data: profiles, error: profileError } = await db
    .from("profiles")
    .select("id,username,twitch_user_id")
    .or(`id.eq.${data.user.id},twitch_user_id.eq.${twitchId}`)
    .limit(3);
  if (profileError) throw Error("Could not check your poker profile.");
  const profile =
    profiles?.find((p) => p.twitch_user_id === twitchId) ||
    profiles?.find((p) => p.id === data.user!.id);
  if (profile)
    return {
      id: "profile:" + profile.id,
      name: String(profile.username || name),
    };
  // Legacy imports stored the Twitch login instead of its numeric ID.
  const { data: legacy, error: legacyError } = await db
    .from("profiles")
    .select("id,username,twitch_user_id")
    .eq("username", name)
    .eq("twitch_user_id", name)
    .maybeSingle();
  if (legacyError) throw Error("Could not check your poker profile.");
  return { id: legacy ? "profile:" + legacy.id : "twitch:" + twitchId, name };
}
export async function registeredPokerPlayer(value: unknown) {
  const id = String(value || "");
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(id))
    throw Error("Select a registered site player.");
  const { data, error } = await siteDb()
    .from("profiles")
    .select("id,username,twitch_user_id")
    .eq("id", id)
    .single();
  if (error || !data?.twitch_user_id)
    throw Error("Registered Twitch player not found.");
  return { playerId: "profile:" + data.id, playerName: String(data.username) };
}
