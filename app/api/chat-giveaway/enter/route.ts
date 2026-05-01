import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  return {
    start_at: start.toISOString().slice(0, 10),
    end_at: end.toISOString().slice(0, 10),
  };
}

async function getRouloBoost(username: string) {
  try {
    const key = process.env.ROULO_API_KEY;

    if (!key) {
      return {
        weight: 1,
        isRouloAffiliate: false,
        rouloWagered: 0,
      };
    }

    const { start_at, end_at } = getDateRange();

    const res = await fetch(
      `https://api.roulobets.com/v1/external/affiliates?start_at=${start_at}&end_at=${end_at}&key=${key}`,
      { cache: "no-store" }
    );

    const json = await res.json();
    const affiliates = json.affiliates || json.data || [];

    const match = affiliates.find((player: any) => {
      const playerName = String(
        player.username ||
          player.name ||
          player.display_name ||
          ""
      )
        .replace("@", "")
        .trim()
        .toLowerCase();

      return playerName === username;
    });

    if (!match) {
      return {
        weight: 1,
        isRouloAffiliate: false,
        rouloWagered: 0,
      };
    }

    const wagered = Number(
      match.wagered_amount ||
        match.amount_wagered ||
        match.wagered ||
        match.total_wagered ||
        0
    );

let weight = 1; // default = normal viewer

if (wagered >= 100) {
  weight = 1.25; // affiliate
}

if (wagered >= 2000) {
  weight = 1.5; // VIP
}

    return {
      weight,
      isRouloAffiliate: true,
      rouloWagered: wagered,
    };
  } catch {
    return {
      weight: 1,
      isRouloAffiliate: false,
      rouloWagered: 0,
    };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const username = String(body.username || "")
    .replace("@", "")
    .trim()
    .toLowerCase();

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
    .single();

  if (giveawayError || !giveaway) {
    return NextResponse.json(
      { ok: false, error: "No live giveaway" },
      { status: 400 }
    );
  }

  const boost = await getRouloBoost(username);

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
        is_roulo_affiliate: boost.isRouloAffiliate,
        roulo_wagered: boost.rouloWagered,
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