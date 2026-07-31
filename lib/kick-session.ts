import crypto from "crypto";

export const KICK_SESSION_COOKIE = "trashguy_kick_session";

export type KickSession = {
  profileId: string;
  kickId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  exp: number;
};

function getSecret() {
  const secret = process.env.KICK_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!secret) throw new Error("Missing KICK_SESSION_SECRET.");
  return secret;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createKickSessionToken(session: Omit<KickSession, "exp">, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const payload: KickSession = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const body = encode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyKickSessionToken(token: string | undefined | null): KickSession | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(decode(body)) as KickSession;
    if (!payload.profileId || !payload.kickId || !payload.username) return null;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
