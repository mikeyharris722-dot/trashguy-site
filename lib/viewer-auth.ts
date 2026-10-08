import "server-only";
import { siteDb } from "./site-db";
import { KICK_SESSION_COOKIE, verifyKickSessionToken } from "./kick-session";
export async function requireViewer(request: Request, platform = "twitch") {
  if (platform === "kick") {
    const value = (request.headers.get("cookie") || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(KICK_SESSION_COOKIE + "="))
      ?.slice(KICK_SESSION_COOKIE.length + 1);
    const kick = verifyKickSessionToken(value);
    if (!kick) throw Error("AUTH: Sign in with Kick to view your rewards.");
    return {
      id: kick.profileId,
      name: kick.username.replace(/^@/, "").trim().toLowerCase(),
      platform: "kick",
    };
  }
  const token = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) throw Error("AUTH: Sign in to view your rewards.");
  const { data, error } = await siteDb().auth.getUser(token);
  const identity = data.user?.identities?.find((i) => i.provider === "twitch");
  const name = String(
    identity?.identity_data?.preferred_username ||
      identity?.identity_data?.name ||
      "",
  )
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (error || !data.user || !identity || !name)
    throw Error("AUTH: Your login session is invalid. Sign in again.");
  return { id: data.user.id, name, platform: "twitch" };
}
