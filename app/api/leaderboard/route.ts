import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.ROULO_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing ROULO_API_KEY" },
        { status: 500 }
      );
    }

    const url = new URL("https://api.roulobets.com/v1/external/affiliates");
    url.searchParams.set("start_at", "2026-04-07");
    url.searchParams.set("end_at", "2026-04-20");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = await res.json();

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}