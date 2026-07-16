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

function withoutTrailingUnderscores(value: string) {
  return normalize(value).replace(/_+$/g, "");
}

export async function GET(req: NextRequest) {
  const rawViewer = normalize(
    req.nextUrl.searchParams.get("viewer") ||
      req.headers.get("x-viewer-name") ||
      ""
  );

  const platform =
    req.nextUrl.searchParams.get("platform") === "kick" ? "kick" : "twitch";

  const usernameColumn =
    platform === "kick" ? "kick_username" : "twitch_username";

  if (!rawViewer) {
    return NextResponse.json({
      ok: false,
      error: "Missing viewer",
      rewards: [],
      totalUnclaimed: 0,
      totalClaimed: 0,
      totalPaid: 0,
    });
  }

  const viewerOptions = Array.from(
    new Set([rawViewer, withoutTrailingUnderscores(rawViewer)])
  );

  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .in(usernameColumn, viewerOptions)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      rewards: [],
      totalUnclaimed: 0,
      totalClaimed: 0,
      totalPaid: 0,
    });
  }

  const rewards = data || [];

  const totalUnclaimed = rewards
    .filter((reward: any) => !reward.claimed && !reward.paid)
    .reduce((sum: number, reward: any) => sum + Number(reward.amount || 0), 0);

  const totalClaimed = rewards
    .filter((reward: any) => reward.claimed && !reward.paid)
    .reduce((sum: number, reward: any) => sum + Number(reward.amount || 0), 0);

  const totalPaid = rewards
    .filter((reward: any) => reward.paid)
    .reduce((sum: number, reward: any) => sum + Number(reward.amount || 0), 0);

  const { data: luckRow } = await supabase
    .from("giveaway_luck")
    .select("*")
    .in("twitch_username", viewerOptions)
    .limit(1)
    .maybeSingle();

  const { data: rouloLink } = await supabase
    .from("roulo_links")
    .select("*")
    .in(usernameColumn, viewerOptions)
    .limit(1)
    .maybeSingle();

  const hasRoulo = !!rouloLink?.roulo_username;
  const hasDiscord =
    !!rouloLink?.is_in_discord ||
    !!rouloLink?.discord_id ||
    !!rouloLink?.discord_username;

  const savedRole = String(rouloLink?.role || "").toLowerCase();
  const isVip = savedRole === "vip";

  const baseOdds = Number(
    (
      1 +
      (hasRoulo ? 1 : 0) +
      (hasDiscord ? 1 : 0) +
      (isVip ? 1 : 0)
    ).toFixed(2)
  );

  const luckOdds = Number(luckRow?.luck || 0);
  const totalOdds = Number((baseOdds + luckOdds).toFixed(2));
  const nextOdds = Number((totalOdds + 1).toFixed(2));

  return NextResponse.json({
    ok: true,
    viewer: rawViewer,
    platform,
    viewerOptions,
    rewards,

    totalUnclaimed,
    totalClaimed,
    totalPaid,

    // keep old names so your current page does not break
    totalPending: totalClaimed,

    baseOdds,
    luckOdds,
    totalOdds,
    nextOdds,

    lossCount: Number(luckRow?.loss_count || 0),
    winCount: Number(luckRow?.win_count || 0),
  });
}