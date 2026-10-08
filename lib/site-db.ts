import { KICK_SESSION_COOKIE, verifyKickSessionToken } from "./kick-session";
import "server-only";
import { createClient } from "@/lib/review-client";
export function siteDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function requireTrackerAdmin(request: Request) {
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    const value = (request.headers.get("cookie") || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(KICK_SESSION_COOKIE + "="))
      ?.slice(KICK_SESSION_COOKIE.length + 1);
    const kick = verifyKickSessionToken(value);
    if (kick) {
      const profile = await siteDb()
        .from("profiles")
        .select("is_admin")
        .eq("id", kick.profileId)
        .maybeSingle();
      if (!profile.error && profile.data?.is_admin) return kick.profileId;
    }
    throw new Error("AUTH: Sign in as an admin.");
  }
  const { data, error } = await siteDb().auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH: Invalid login session.");
  const identity = data.user.identities?.find((i) => i.provider === "twitch");
  if (!identity) throw Error("AUTH: Sign in with Twitch as an admin.");
  const db = siteDb();
  let profile = await db.from("profiles").select("id,is_admin,twitch_user_id,username")
    .eq("id", data.user.id).maybeSingle();
  if (profile.error) throw new Error("AUTH: Could not verify admin access.");
  // Older profiles predate Supabase Auth and use independent profile UUIDs.
  // Only the validated OAuth identity may resolve them; never user_metadata.
  if (!profile.data) {
    const twitchId = String(identity.identity_data?.provider_id || identity.identity_data?.sub || "");
    const login = String(identity.identity_data?.preferred_username || identity.identity_data?.name || "").trim().toLowerCase();
    if (!/^\d+$/.test(twitchId) || !login) throw new Error("AUTH: Admin access required.");
    profile = await db.from("profiles").select("id,is_admin,twitch_user_id,username")
      .eq("twitch_user_id", twitchId).maybeSingle();
    if (profile.error) throw new Error("AUTH: Could not verify admin access.");
    if (!profile.data) {
      profile = await db.from("profiles").select("id,is_admin,twitch_user_id,username")
        .eq("username", login).maybeSingle();
      if (profile.error) throw new Error("AUTH: Could not verify admin access.");
      // Legacy imports stored the Twitch login in the Twitch-ID column.
      if (profile.data && String(profile.data.twitch_user_id).toLowerCase() !== login)
        throw new Error("AUTH: Admin access required.");
    }
  }
  if (!profile.data?.is_admin) throw new Error("AUTH: Admin access required.");
  return profile.data.id || data.user.id;
}
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  return Response.json(
    { error: message },
    { status: message.startsWith("AUTH:") ? 403 : 400 },
  );
}
