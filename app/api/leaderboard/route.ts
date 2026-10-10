import {withLeaderboardBadges} from "@/lib/leaderboard-badges";
import { NextResponse } from "next/server";
import { communityState } from "@/lib/community-local";
import { resolvedPrizeSettings } from "@/lib/prize-settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const apiKey = process.env.ROULO_API_KEY;
    const settings = resolvedPrizeSettings((await communityState()).prizeSettings);

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        affiliates: [],
        note: "Missing ROULO_API_KEY",
      });
    }

    const url = new URL("https://api.roulobets.com/v1/external/affiliates");
    url.searchParams.set("start_at", settings.leaderboardStart);
    url.searchParams.set("end_at", settings.leaderboardEnd);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("weighted", "true");

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();

      return NextResponse.json({
        success: true,
        affiliates: [],
        note: `Roulo API error: ${text}`,
      });
    }

    const data = await res.json();

    const affiliates = Array.isArray(data?.affiliates)
      ? data.affiliates
      : Array.isArray(data)
      ? data
      : [];

    let displayed = affiliates;
    try { displayed = await withLeaderboardBadges(affiliates); } catch { /* Badge failure must not hide standings. */ }
    return NextResponse.json({
      success: true,
      affiliates: displayed,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      affiliates: [],
      note: error?.message || "Failed to load leaderboard",
    });
  }
}