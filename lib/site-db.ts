import { KICK_SESSION_COOKIE, verifyKickSessionToken } from "./kick-session";
import "server-only";
import { createClient } from "@supabase/supabase-js";
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
  const trustedName = String(
    identity?.identity_data?.name ||
      identity?.identity_data?.preferred_username ||
      "",
  ).toLowerCase();
  const profile = trustedName
    ? await siteDb()
        .from("profiles")
        .select("is_admin")
        .eq("username", trustedName)
        .maybeSingle()
    : null;
  if (profile?.error || !profile?.data?.is_admin)
    throw new Error("AUTH: Admin access required.");
  return data.user.id;
}
export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  return Response.json(
    { error: message },
    { status: message.startsWith("AUTH:") ? 403 : 400 },
  );
}
