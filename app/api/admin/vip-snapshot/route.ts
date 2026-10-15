import {providerRows} from "@/lib/leaderboard-provider";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/review-client";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: string) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

function getPlayerName(player: any) {
  return normalize(
    player?.username ||
      player?.name ||
      player?.display_name ||
      player?.user_name ||
      player?.player_name ||
      player?.affiliate_username ||
      player?.user?.username ||
      player?.user?.name ||
      ""
  );
}

function getPlayerWagered(player: any) {
  return Number(
    player?.weighted_wagered_amount ??
      player?.weightedWageredAmount ??
      player?.weighted_wagered ??
      0
  );
}

export async function POST() {
  const key = process.env.ROULO_API_KEY;

  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing ROULO_API_KEY" }, { status: 500 });
  }

  const periodStart = "2026-09-05";
  const periodEnd = "2026-10-05";

  let affiliates:Record<string,unknown>[];
  try { affiliates=await providerRows(periodStart,periodEnd,{fresh:true}); }
  catch { return NextResponse.json({ok:false,error:"Roulo data is unavailable or rate limited. The existing VIP snapshot was retained."},{status:503}); }

  const vipRows = affiliates
    .map((player: any) => ({
      period_start: periodStart,
      period_end: periodEnd,
      roulo_username: getPlayerName(player),
      wagered: getPlayerWagered(player),
    }))
    .filter((row: any) => row.roulo_username && row.wagered >= 5000);

const { error: snapshotDeleteError } = await supabase
  .from("vip_snapshots")
  .delete()
  .eq("period_start", periodStart)
  .eq("period_end", periodEnd);

if (snapshotDeleteError) {
  return NextResponse.json(
    { ok: false, error: snapshotDeleteError.message },
    { status: 500 }
  );
}

const { error: snapshotUpsertError } = await supabase
  .from("vip_snapshots")
  .upsert(vipRows, {
    onConflict: "period_start,period_end,roulo_username",
  });

if (snapshotUpsertError) {
  return NextResponse.json(
    { ok: false, error: snapshotUpsertError.message },
    { status: 500 }
  );
}

  return NextResponse.json({
    ok: true,
    periodStart,
    periodEnd,
    saved: vipRows.length,
    vipRows,
  });
}