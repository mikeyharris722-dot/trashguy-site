import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const apiKey = process.env.ROULO_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        affiliates: [],
        note: "Missing ROULO_API_KEY",
      });
    }

    const url = new URL("https://api.roulobets.com/v1/external/affiliates");
    url.searchParams.set("start_at", "2026-04-07");
    url.searchParams.set("end_at", "2026-04-20");
    url.searchParams.set("key", apiKey);

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

    return NextResponse.json({
      success: true,
      affiliates,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      affiliates: [],
      note: error?.message || "Failed to load leaderboard",
    });
  }
}