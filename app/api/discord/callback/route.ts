import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: string) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

function decodeState(state: string) {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";

  const decoded = decodeState(state);
  const viewer = normalize(decoded?.viewer || "");
const platform = decoded?.platform === "kick" ? "kick" : "twitch";

  if (!code || !viewer) {
    return NextResponse.redirect(
      new URL("/?discord=missing", req.nextUrl.origin)
    );
  }

  const clientId = process.env.DISCORD_CLIENT_ID || "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
  const redirectUri = process.env.DISCORD_REDIRECT_URI || "";
  const guildId = process.env.DISCORD_GUILD_ID || "";
  const botToken = process.env.DISCORD_BOT_TOKEN || "";

  if (!clientId || !clientSecret || !redirectUri || !guildId || !botToken) {
    return NextResponse.redirect(
      new URL("/?discord=env-missing", req.nextUrl.origin)
    );
  }

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.redirect(
      new URL("/?discord=token-failed", req.nextUrl.origin)
    );
  }

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const discordUser = await userRes.json();

  if (!userRes.ok || !discordUser?.id) {
    return NextResponse.redirect(
      new URL("/?discord=user-failed", req.nextUrl.origin)
    );
  }

  const memberRes = await fetch(
    `https://discord.com/api/guilds/${guildId}/members/${discordUser.id}`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    }
  );

  const isInDiscord = memberRes.ok;

const discordUsername =
  discordUser.username ||
  discordUser.global_name ||
  discordUser.id;

console.log("DISCORD VIEWER:", viewer, "PLATFORM:", platform);

const usernameColumn =
  platform === "kick" ? "kick_username" : "twitch_username";

const displayNameColumn =
  platform === "kick" ? "kick_display_name" : "twitch_display_name";

const { data: existingLink } = await supabase
  .from("roulo_links")
  .select("*")
  .eq(usernameColumn, viewer)
  .maybeSingle();

const payload: any = {
  [usernameColumn]: viewer,
  [displayNameColumn]: existingLink?.[displayNameColumn] || viewer,

  roulo_username: existingLink?.roulo_username || null,
  wagered: Number(existingLink?.wagered || 0),
  role: existingLink?.role || "viewer",
  weight: Number(existingLink?.weight || 1),

  discord_id: discordUser.id,
  discord_username: discordUsername,
  is_in_discord: isInDiscord,

  updated_at: new Date().toISOString(),
};

const { error } = existingLink?.id
  ? await supabase.from("roulo_links").update(payload).eq("id", existingLink.id)
  : await supabase.from("roulo_links").insert(payload);

if (error) {
  console.error("DISCORD SAVE ERROR:", error);

  return NextResponse.json({
    ok: false,
    error,
  });
}

return NextResponse.redirect(
  new URL(
    `/?discord=${isInDiscord ? "linked" : "not-in-server"}&section=prizeportal`,
    req.nextUrl.origin
  )
);
}