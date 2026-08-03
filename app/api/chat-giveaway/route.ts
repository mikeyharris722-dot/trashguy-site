import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

type GiveawayType = "regular" | "vip";

function getGiveawayType(req: NextRequest): GiveawayType {
  return req.nextUrl.searchParams.get("type") === "vip" ? "vip" : "regular";
}

function normalize(value: unknown) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const giveawayType = getGiveawayType(req);

  const { data: giveaways, error: giveawayError } = await supabase
    .from("chat_giveaways")
    .select("*")
    .eq("giveaway_type", giveawayType)
    .order("created_at", { ascending: false })
    .limit(1);

  if (giveawayError) {
    return NextResponse.json(
      { ok: false, error: giveawayError.message },
      { status: 500 }
    );
  }

  const giveaway = giveaways?.[0] || null;
  let entries: any[] = [];

  if (giveaway?.id) {
    const { data: entryData, error: entryError } = await supabase
      .from("chat_giveaway_entries")
      .select("*")
      .eq("giveaway_id", giveaway.id)
      .order("created_at", { ascending: true });

    if (entryError) {
      return NextResponse.json(
        { ok: false, error: entryError.message },
        { status: 500 }
      );
    }

    const rawEntries = entryData || [];
    const usernames = Array.from(
      new Set(rawEntries.map((entry: any) => normalize(entry.username)).filter(Boolean))
    );

    let luckRows: any[] = [];

    if (usernames.length > 0) {
      const { data, error } = await supabase
        .from("giveaway_luck")
        .select("twitch_username, luck, loss_count, win_count")
        .in("twitch_username", usernames);

      if (error) {
        console.error("Giveaway luck lookup failed:", error);
      } else {
        luckRows = data || [];
      }
    }

    const luckMap = new Map(
      luckRows.map((row: any) => [normalize(row.twitch_username), row])
    );

    entries = rawEntries.map((entry: any) => {
      const username = normalize(entry.username);
      const luckRow = luckMap.get(username);
      const baseOdds = Number(entry.weight || 1);
      const luckOdds = Number(luckRow?.luck || 0);

      return {
        ...entry,
        base_odds: baseOdds,
        luck_odds: luckOdds,
        total_odds: Number((baseOdds + luckOdds).toFixed(2)),
        loss_count: Number(luckRow?.loss_count || 0),
        win_count: Number(luckRow?.win_count || 0),
      };
    });
  }

  const { data: winnerRows, error: winnerError } = await supabase
    .from("chat_giveaways")
    .select("id, winner_username, finished_at, giveaway_type")
    .eq("giveaway_type", giveawayType)
    .not("winner_username", "is", null)
    .order("finished_at", { ascending: false })
    .limit(20);

  if (winnerError) {
    return NextResponse.json(
      { ok: false, error: winnerError.message },
      { status: 500 }
    );
  }

  const winnerCounts: Record<string, number> = {};

  (winnerRows || []).forEach((row: any) => {
    const username = normalize(row.winner_username);
    if (!username) return;
    winnerCounts[username] = (winnerCounts[username] || 0) + 1;
  });

  return NextResponse.json({
    ok: true,
    giveawayType,
    giveaway,
    entries,
    recentWinners: winnerRows || [],
    winnerCounts,
  });
}

export async function POST(req: NextRequest) {
  const giveawayType = getGiveawayType(req);
  const now = new Date().toISOString();

  const { error: closeError } = await supabase
    .from("chat_giveaways")
    .update({
      status: "finished",
      finished_at: now,
    })
    .eq("giveaway_type", giveawayType)
    .eq("status", "live");

  if (closeError) {
    return NextResponse.json(
      { ok: false, error: closeError.message },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("chat_giveaways")
    .insert({
      title: giveawayType === "vip" ? "VIP Chat Giveaway" : "Chat Giveaway",
      keyword: "trash",
      status: "live",
      giveaway_type: giveawayType,
    })
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
    giveawayType,
    giveaway: data,
  });
}
