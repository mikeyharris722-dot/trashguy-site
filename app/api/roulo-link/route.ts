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

function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return {
    start_at: start.toISOString().slice(0, 10),
    end_at: end.toISOString().slice(0, 10),
  };
}

function getRoleAndWeight(wagered: number) {
  if (wagered >= 2000) {
    return { role: "vip", weight: 1.5 };
  }

  if (wagered >= 100) {
    return { role: "affiliate", weight: 1.25 };
  }

  return { role: "viewer", weight: 1 };
}

async function getRouloAffiliate(rouloUsername: string) {
  const key = process.env.ROULO_API_KEY;

  if (!key) {
    throw new Error("Missing ROULO_API_KEY");
  }

  const { start_at, end_at } = getDateRange();

  const res = await fetch(
    `https://api.roulobets.com/v1/external/affiliates?start_at=${start_at}&end_at=${end_at}&key=${key}`,
    { cache: "no-store" }
  );

  const json = await res.json();
  const affiliates = json.affiliates || json.data || [];

  const match = affiliates.find((player: any) => {
    const name = normalize(
      player.username ||
        player.name ||
        player.display_name ||
        player.user_name ||
        ""
    );

    return name === normalize(rouloUsername);
  });

  if (!match) {
    return null;
  }

  const wagered = Number(
    match.wagered_amount ||
      match.amount_wagered ||
      match.wagered ||
      match.total_wagered ||
      0
  );

  return {
    rouloUsername: normalize(rouloUsername),
    wagered,
  };
}

export async function GET(req: NextRequest) {
  const twitchUsername = normalize(req.nextUrl.searchParams.get("twitch") || "");

  if (!twitchUsername) {
    return NextResponse.json({ ok: false, error: "Missing Twitch username" });
  }

  const { data, error } = await supabase
    .from("roulo_links")
    .select("*")
    .eq("twitch_username", twitchUsername)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({
    ok: true,
    link: data || null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const twitchUsername = normalize(body.twitch_username || "");
  const twitchDisplayName = body.twitch_display_name || twitchUsername;
  const rouloUsername = normalize(body.roulo_username || "");

  if (!twitchUsername) {
    return NextResponse.json({ ok: false, error: "Missing Twitch username" });
  }

  if (!rouloUsername) {
    return NextResponse.json({ ok: false, error: "Enter your Roulo username." });
  }

  const affiliate = await getRouloAffiliate(rouloUsername);

  if (!affiliate) {
    return NextResponse.json({
      ok: false,
      error: "That Roulo username was not found under your affiliate list.",
    });
  }

  const { role, weight } = getRoleAndWeight(affiliate.wagered);

  const { data, error } = await supabase
    .from("roulo_links")
    .upsert(
      {
        twitch_username: twitchUsername,
        twitch_display_name: twitchDisplayName,
        roulo_username: affiliate.rouloUsername,
        wagered: affiliate.wagered,
        role,
        weight,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "twitch_username" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({
    ok: true,
    link: data,
  });
}