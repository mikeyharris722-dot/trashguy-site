import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  const { data: giveaways, error: giveawayError } = await supabase
    .from("chat_giveaways")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (giveawayError) {
    return NextResponse.json({ ok: false, error: giveawayError.message }, { status: 500 });
  }

  const giveaway = giveaways?.[0] || null;

  let entries: any[] = [];

if (giveaway?.id) {
  const { data: entryData } = await supabase
    .from("chat_giveaway_entries")
    .select("*")
    .eq("giveaway_id", giveaway.id)
    .order("created_at", { ascending: true });

  const rawEntries = entryData || [];

  const { data: luckRows } = await supabase
    .from("giveaway_luck")
    .select("twitch_username, luck, loss_count, win_count")
    .in(
      "twitch_username",
      rawEntries.map((entry: any) =>
        String(entry.username || "")
          .replace("@", "")
          .trim()
          .toLowerCase()
      )
    );

  const luckMap = new Map(
    (luckRows || []).map((row: any) => [
      row.twitch_username,
      row,
    ])
  );

  entries = rawEntries.map((entry: any) => {
    const username = String(entry.username || "")
      .replace("@", "")
      .trim()
      .toLowerCase();

    const luckRow = luckMap.get(username);

    const baseOdds = Number(entry.weight || 1);
    const luckOdds = Number(luckRow?.luck || 0);
    const totalOdds = Number((baseOdds + luckOdds).toFixed(2));

    return {
      ...entry,
      base_odds: baseOdds,
      luck_odds: luckOdds,
      total_odds: totalOdds,
      loss_count: Number(luckRow?.loss_count || 0),
      win_count: Number(luckRow?.win_count || 0),
    };
  });
}

  const { data: winnerRows } = await supabase
    .from("chat_giveaways")
    .select("id, winner_username, finished_at")
    .not("winner_username", "is", null)
    .order("finished_at", { ascending: false })
    .limit(20);

  const winnerCounts: Record<string, number> = {};

  (winnerRows || []).forEach((row: any) => {
    const username = String(row.winner_username || "").toLowerCase();
    if (!username) return;
    winnerCounts[username] = (winnerCounts[username] || 0) + 1;
  });

  return NextResponse.json({
    ok: true,
    giveaway,
    entries,
    recentWinners: winnerRows || [],
    winnerCounts,
  });
}

export async function POST() {
  const { data, error } = await supabase
    .from("chat_giveaways")
    .insert({
      title: "Chat Giveaway",
      keyword: "trash",
      status: "live",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    giveaway: data,
  });
}