import { NextResponse } from "next/server";
import crypto from "crypto";

function base64url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(16));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.KICK_CLIENT_ID || "",
    redirect_uri: process.env.KICK_REDIRECT_URI || "",
    scope: "user:read",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  const res = NextResponse.redirect(`https://id.kick.com/oauth/authorize?${params.toString()}`);

  res.cookies.set("kick_code_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  res.cookies.set("kick_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return res;
}