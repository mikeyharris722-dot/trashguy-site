import { NextRequest, NextResponse } from "next/server";

function normalize(value: string) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const viewer = normalize(req.nextUrl.searchParams.get("viewer") || "");
const platform =
  req.nextUrl.searchParams.get("platform") === "kick" ? "kick" : "twitch";

  if (!viewer) {
    return NextResponse.json(
      { ok: false, error: "Missing viewer" },
      { status: 400 }
    );
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { ok: false, error: "Missing Discord env vars" },
      { status: 500 }
    );
  }

const state = Buffer.from(
  JSON.stringify({
    viewer,
    platform,
    createdAt: Date.now(),
  })
).toString("base64url");

  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}