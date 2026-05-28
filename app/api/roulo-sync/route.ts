import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function normalize(value: string) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const key = process.env.ROULO_API_KEY;
  const user = normalize(req.nextUrl.searchParams.get("user") || "");

  if (!key) {
    return NextResponse.json({ ok: false, error: "Missing ROULO_API_KEY" });
  }

  if (!user) {
    return NextResponse.json({ ok: false, error: "Add ?user=rouloUsername" });
  }

  const end = new Date().toISOString().slice(0, 10);

  const res = await fetch(
    `https://api.roulobets.com/v1/external/affiliates?start_at=2024-01-01&end_at=${end}&key=${key}`,
    { cache: "no-store" }
  );

  const json = await res.json();

  const affiliates = Array.isArray(json?.affiliates)
    ? json.affiliates
    : Array.isArray(json?.data)
    ? json.data
    : [];

  const match = affiliates.find((player: any) => {
    const name = normalize(
      player.username ||
        player.name ||
        player.display_name ||
        player.user_name ||
        player.player_name ||
        ""
    );

    return name === user;
  });

  return NextResponse.json({
    ok: true,
    searchedUser: user,
    affiliateCount: affiliates.length,
    match: match || null,
    firstAffiliateExample: affiliates[0] || null,
  });
}