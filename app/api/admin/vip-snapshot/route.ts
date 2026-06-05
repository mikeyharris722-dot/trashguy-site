import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    player?.wagered_amount ??
      player?.amount_wagered ??
      player?.wagered ??
      player?.total_wagered ??
      player?.totalWagered ??
      player?.wageredAmount ??
      0
  );
}

export async function POST() {
  const key = process.env.ROULO_API_KEY;

  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing ROULO_API_KEY" }, { status: 500 });
  }

  const periodStart = "2026-06-05";
  const periodEnd = "2026-07-05";

  const url = new URL("https://api.roulobets.com/v1/external/affiliates");
  url.searchParams.set("start_at", periodStart);
  url.searchParams.set("end_at", periodEnd);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();

const affiliates = Array.isArray(json)
  ? json
  : Array.isArray(json?.affiliates)
  ? json.affiliates
  : Array.isArray(json?.data)
  ? json.data
  : Array.isArray(json?.results)
  ? json.results
  : Array.isArray(json?.players)
  ? json.players
  : Array.isArray(json?.users)
  ? json.users
  : Array.isArray(json?.data?.affiliates)
  ? json.data.affiliates
  : Array.isArray(json?.data?.results)
  ? json.data.results
  : [];

  const vipRows = affiliates
    .map((player: any) => ({
      period_start: periodStart,
      period_end: periodEnd,
      roulo_username: getPlayerName(player),
      wagered: getPlayerWagered(player),
    }))
    .filter((row: any) => row.roulo_username && row.wagered >= 5000);

  const { error } = await supabase
    .from("vip_snapshots")
    .upsert(vipRows, {
      onConflict: "period_start,period_end,roulo_username",
    });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    periodStart,
    periodEnd,
    saved: vipRows.length,
    vipRows,
  });
}