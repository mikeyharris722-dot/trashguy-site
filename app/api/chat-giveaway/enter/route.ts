import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncRouloLinks } from "@/lib/roulo-sync";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: string) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

function getRoleAndWeight(wagered: number) {
  if (wagered >= 5000) {
    return { role: "vip", weight: 1.2, isRouloAffiliate: true };
  }

  if (wagered >= 100) {
    return { role: "affiliate", weight: 1.1, isRouloAffiliate: true };
  }

  return { role: "viewer", weight: 1, isRouloAffiliate: false };
}

async function getSavedRouloBoost(twitchUsername: string) {
  const cleanTwitch = normalize(twitchUsername);

  // Refresh all linked Roulo accounts before reading this entry.
  // This makes giveaway entries update automatically.
  try {
    await syncRouloLinks();
  } catch (error) {
    console.error("Roulo sync failed before giveaway entry:", error);
  }

  const { data: link, error } = await supabase
    .from("roulo_links")
    .select("roulo_username, wagered, role, weight")
    .eq("twitch_username", cleanTwitch)
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
    };
  }

  const wagered = Number(link.wagered || 0);
  const resolved = getRoleAndWeight(wagered);

  return {
    weight: resolved.weight,
    role: resolved.role,
    isRouloAffiliate: resolved.isRouloAffiliate,
    rouloWagered: wagered,
    rouloUsername: link.roulo_username || null,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const username = normalize(body.username || "");

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

  const boost = await getSavedRouloBoost(username);

  const { data, error } = await supabase
    .from("chat_giveaway_entries")
    .upsert(
      {
        giveaway_id: giveaway.id,
        username,
        display_name: body.display_name || username,
        twitch_id: body.twitch_id || null,
        avatar_url: body.avatar_url || null,

        weight: boost.weight,
        role: boost.role,
        is_roulo_affiliate: boost.isRouloAffiliate,
        roulo_wagered: boost.rouloWagered,
        roulo_username: boost.rouloUsername,
        updated_at: new Date().toISOString(),
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