import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const apiKey = process.env.BONUSHUNT_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        hunts: [],
        note: "Missing BONUSHUNT_API_KEY"
      });
    }

    const res = await fetch("https://bonushunt.gg/api/public/hunts?limit=10", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();

      return NextResponse.json({
        success: true,
        hunts: [],
        note: `BonusHunt API error: ${text}`
      });
    }

    const data = await res.json();

    const hunts = Array.isArray(data?.hunts)
      ? data.hunts
      : Array.isArray(data)
      ? data
      : [];

    return NextResponse.json({
      success: true,
      hunts
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      hunts: [],
      note: error?.message || "Failed to load hunts"
    });
  }
}