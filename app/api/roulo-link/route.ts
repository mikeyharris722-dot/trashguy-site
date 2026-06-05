import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncRouloLinks } from "@/lib/roulo-sync";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: string) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

function getDateRange() {
  const end = new Date();

  return {
    start_at: "2024-01-01",
    end_at: end.toISOString().slice(0, 10),
  };
}

async function getRoleAndWeight({
  rouloUsername,
  existingLink,
}: {
  rouloUsername: string;
  existingLink?: any;
}) {
  const { data: latestSnapshot } = await supabase
    .from("vip_snapshots")
    .select("period_start, period_end")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  let vipSnapshot = null;

  if (latestSnapshot) {
    const { data } = await supabase
      .from("vip_snapshots")
      .select("id")
      .eq("roulo_username", rouloUsername)
      .eq("period_start", latestSnapshot.period_start)
      .eq("period_end", latestSnapshot.period_end)
      .limit(1)
      .maybeSingle();

    vipSnapshot = data;
  }

  const isOnCode = !!rouloUsername;
  const isInDiscord = !!existingLink?.is_in_discord;
  const isVipSnapshot = !!vipSnapshot;

  const weight =
    1 +
    (isOnCode ? 0.1 : 0) +
    (isInDiscord ? 0.1 : 0) +
    (isVipSnapshot ? 0.3 : 0);

  const role = isVipSnapshot ? "vip" : isOnCode ? "affiliate" : "viewer";

  return {
    role,
    weight: Number(weight.toFixed(2)),
  };
}

async function getRouloAffiliate(rouloUsername: string) {
  const key = process.env.ROULO_API_KEY;

  if (!key) {
    throw new Error("Missing ROULO_API_KEY");
  }

  const { start_at, end_at } = getDateRange();

  const res = await fetch(
    `https://api.roulobets.com/v1/external/affiliates?start_at=${start_at}&end_at=${end_at}&key=${key}`,
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
        ""
    );

    return name === normalize(rouloUsername);
  });

  if (!match) return null;

  const wagered = Number(
    match.wagered_amount ||
      match.amount_wagered ||
      match.wagered ||
      match.total_wagered ||
      0
  );

  return {
    rouloUsername: normalize(rouloUsername),
    wagered,
  };
}

export async function GET(req: NextRequest) {
  const twitchUsername = normalize(req.nextUrl.searchParams.get("twitch") || "");

  if (!twitchUsername) {
    return NextResponse.json({ ok: false, error: "Missing Twitch username" });
  }

  const { data: existingLink, error } = await supabase
    .from("roulo_links")
    .select("*")
    .eq("twitch_username", twitchUsername)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  if (!existingLink?.roulo_username) {
    return NextResponse.json({
      ok: true,
      link: existingLink || null,
    });
  }

  try {
    const affiliate = await getRouloAffiliate(existingLink.roulo_username);

    if (!affiliate) {
      return NextResponse.json({
        ok: true,
        link: existingLink,
        warning: "Roulo username was not found during refresh.",
      });
    }

    const { role, weight } = await getRoleAndWeight({
  rouloUsername: affiliate.rouloUsername,
  existingLink,
});

    const { data: updatedLink, error: updateError } = await supabase
      .from("roulo_links")
      .update({
        wagered: affiliate.wagered,
        role,
        weight,
        updated_at: new Date().toISOString(),
      })
      .eq("twitch_username", twitchUsername)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message });
    }

    return NextResponse.json({
      ok: true,
      link: updatedLink,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: true,
      link: existingLink,
      warning: err?.message || "Could not refresh Roulo stats.",
    });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const twitchUsername = normalize(body.twitch_username || "");
  const twitchDisplayName = body.twitch_display_name || twitchUsername;
  const rouloUsername = normalize(body.roulo_username || "");

  if (!twitchUsername) {
    return NextResponse.json({ ok: false, error: "Missing Twitch username" });
  }

  if (!rouloUsername) {
    return NextResponse.json({ ok: false, error: "Enter your Roulo username." });
  }

  const affiliate = await getRouloAffiliate(rouloUsername);

  if (!affiliate) {
    return NextResponse.json({
      ok: false,
      error: "That Roulo username was not found under your affiliate list.",
    });
  }

  const { role, weight } = await getRoleAndWeight({
  rouloUsername: affiliate.rouloUsername,
  existingLink: null,
});

  const { data, error } = await supabase
    .from("roulo_links")
    .upsert(
      {
        twitch_username: twitchUsername,
        twitch_display_name: twitchDisplayName,
        roulo_username: affiliate.rouloUsername,
        wagered: affiliate.wagered,
        role,
        weight,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "twitch_username" }
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({
    ok: true,
    link: data,
  });
}