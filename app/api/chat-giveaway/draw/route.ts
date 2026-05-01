import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function pickWeightedWinner(entries: any[]) {
  const totalWeight = entries.reduce((sum, entry) => {
    return sum + Math.max(1, Number(entry.weight || 1));
  }, 0);

  let random = Math.random() * totalWeight;

  for (const entry of entries) {
    random -= Math.max(1, Number(entry.weight || 1));

    if (random <= 0) {
      return entry;
    }
  }

  return entries[entries.length - 1];
}

export async function GET(req: NextRequest) {
  const amount = Number(req.nextUrl.searchParams.get("amount") || 0);

  const { data: giveaway, error: giveawayError } = await supabase
    .from("chat_giveaways")
    .select("id")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (giveawayError || !giveaway) {
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

  const winnerUsername = String(winner.username || "")
    .replace("@", "")
    .trim()
    .toLowerCase();

  const winnerDisplayName = winner.display_name || winnerUsername;

  const totalWeight = entries.reduce(
    (sum, entry) => sum + Math.max(1, Number(entry.weight || 1)),
    0
  );

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
      twitch_id: winner.twitch_id || null,
      display_name: winnerDisplayName,
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
    total_weight: totalWeight,
    winner_weight: Number(winner.weight || 1),
    winner_role: winner.role || "viewer",
    winner_roulo_username: winner.roulo_username || null,
  });
}