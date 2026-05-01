import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function pickWeightedWinner(entries: any[]) {
  const totalWeight = entries.reduce(
    (sum, entry) => sum + Math.max(1, Number(entry.weight || 1)),
    0
  );

  let random = Math.random() * totalWeight;

  for (const entry of entries) {
    random -= Math.max(1, Number(entry.weight || 1));
    if (random <= 0) return entry;
  }

  return entries[entries.length - 1];
}

export async function GET(req: NextRequest) {
  const amount = Number(req.nextUrl.searchParams.get("amount") || 0);

  const { data: giveaway } = await supabase
    .from("chat_giveaways")
    .select("id")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!giveaway) {
    return NextResponse.json({ ok: false, error: "No live giveaway" });
  }

  const { data: entries, error: entriesError } = await supabase
    .from("chat_giveaway_entries")
    .select("*")
    .eq("giveaway_id", giveaway.id);

  if (entriesError) {
    return NextResponse.json({ ok: false, error: entriesError.message });
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ ok: false, error: "No entries" });
  }

  const winner = pickWeightedWinner(entries);
  const winnerUsername = String(winner.username || "").toLowerCase().trim();
  const winnerTwitchId = winner.twitch_id || null;

  const { error: updateError } = await supabase
    .from("chat_giveaways")
    .update({
      winner_username: winnerUsername,
      status: "finished",
      finished_at: new Date().toISOString(),
    })
    .eq("id", giveaway.id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message });
  }

  if (amount > 0) {
    await supabase.from("rewards").insert({
      twitch_username: winnerUsername,
      twitch_id: winnerTwitchId,
      display_name: winner.display_name || winnerUsername,
      amount,
      title: "Chat Giveaway",
      status: "pending",
      giveaway_id: giveaway.id,
    });
  }

  return NextResponse.json({
    ok: true,
    winner,
    amount,
    total_entries: entries.length,
  });
}