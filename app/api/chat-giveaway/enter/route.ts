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

async function getSavedRouloBoost(username: string, platform: string) {
  const cleanUsername = normalize(username);
  const usernameColumn = platform === "kick" ? "kick_username" : "twitch_username";

  const { data: link, error } = await supabase
    .from("roulo_links")
    .select("roulo_username, wagered, role, weight, is_in_discord, discord_id, discord_username")
    .eq(usernameColumn, cleanUsername)
    .maybeSingle();

  if (error) {
    console.error("Roulo link lookup failed:", error);
  }

  if (!link) {
    return {
      weight: 1,
      role: "viewer",
      isRouloAffiliate: false,
      rouloWagered: 0,
      rouloUsername: null,
      isInDiscord: false,
      discordUsername: null,
    };
  }

const hasRoulo = !!link.roulo_username;
const hasDiscord =
  !!link.is_in_discord ||
  !!link.discord_id ||
  !!link.discord_username;

const savedRole = String(link.role || "").toLowerCase();
const role = savedRole === "vip" ? "vip" : hasRoulo ? "affiliate" : "viewer";

const weight = Number(
  (
    1 +
    (hasRoulo ? 0.1 : 0) +
    (hasDiscord ? 0.1 : 0) +
    (role === "vip" ? 0.3 : 0)
  ).toFixed(2)
);

return {
  weight,
  role,
  isRouloAffiliate: hasRoulo,
  rouloWagered: Number(link.wagered || 0),
  rouloUsername: link.roulo_username || null,
  isInDiscord: hasDiscord,
  discordUsername: link.discord_username || null,
};
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const username = normalize(body.username || "");
  const platform = normalize(body.platform || "twitch") === "kick" ? "kick" : "twitch";

  if (!username) {
    return NextResponse.json(
      { ok: false, error: "Missing username" },
      { status: 400 }
    );
  }

  const { data: giveaway, error: giveawayError } = await supabase
    .from("chat_giveaways")
    .select("id")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (giveawayError || !giveaway) {
    return NextResponse.json(
      { ok: false, error: "No live giveaway" },
      { status: 400 }
    );
  }

  const boost = await getSavedRouloBoost(username, platform);

  const { data, error } = await supabase
    .from("chat_giveaway_entries")
    .upsert(
      {
        giveaway_id: giveaway.id,
        username,
        display_name: body.display_name || username,
        twitch_id: body.twitch_id || null,
        avatar_url: body.avatar_url || null,
        platform,

        weight: boost.weight,
        role: boost.role,
        is_roulo_affiliate: boost.isRouloAffiliate,
        roulo_wagered: boost.rouloWagered,
        roulo_username: boost.rouloUsername,
        is_in_discord: boost.isInDiscord,
        discord_username: boost.discordUsername,
      },
      { onConflict: "giveaway_id,username" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    entry: data,
  });
}