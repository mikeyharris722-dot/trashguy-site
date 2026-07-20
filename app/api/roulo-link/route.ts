import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncRouloLinks } from "@/lib/roulo-sync";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: unknown) {
  return String(value || "")
    .replace("@", "")
    .trim()
    .toLowerCase();
}

function withoutTrailingUnderscores(value: unknown) {
  return normalize(value).replace(/_+$/g, "");
}

function usernameOptions(value: unknown) {
  return Array.from(
    new Set([
      normalize(value),
      withoutTrailingUnderscores(value),
    ])
  ).filter(Boolean);
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

  const isOnCode = Boolean(rouloUsername);

  const isInDiscord = Boolean(
    existingLink?.is_in_discord ||
      existingLink?.discord_id ||
      existingLink?.discord_username
  );

  const isVipSnapshot = Boolean(vipSnapshot);

  const weight =
    1 +
    (isOnCode ? 1 : 0) +
    (isInDiscord ? 1 : 0) +
    (isVipSnapshot ? 1 : 0);

  const role = isVipSnapshot
    ? "vip"
    : isOnCode
      ? "affiliate"
      : "viewer";

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

  if (!res.ok) {
    throw new Error(`Roulo API returned ${res.status}`);
  }

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

  if (!match) {
    return null;
  }

  const wagered = Number(
    match.wagered_amount ||
      match.amount_wagered ||
      match.wagered ||
      match.total_wagered ||
      0
  );

  return {
    rouloUsername: normalize(rouloUsername),
    wagered: Number.isFinite(wagered) ? wagered : 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    const platform =
      req.nextUrl.searchParams.get("platform") === "kick"
        ? "kick"
        : "twitch";

    const legacyTwitchUsername = normalize(
      req.nextUrl.searchParams.get("twitch") || ""
    );

    const viewerUsername = normalize(
      req.nextUrl.searchParams.get("viewer") ||
        legacyTwitchUsername
    );

    if (!viewerUsername) {
      return NextResponse.json({
        ok: false,
        error: `Missing ${
          platform === "kick" ? "Kick" : "Twitch"
        } username`,
        link: null,
      });
    }

    const usernameColumn =
      platform === "kick"
        ? "kick_username"
        : "twitch_username";

    const viewerOptions = usernameOptions(viewerUsername);

    const { data: existingLink, error } = await supabase
      .from("roulo_links")
      .select("*")
      .in(usernameColumn, viewerOptions)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        link: null,
      });
    }

    if (!existingLink?.roulo_username) {
      return NextResponse.json({
        ok: true,
        viewer: viewerUsername,
        platform,
        link: existingLink || null,
      });
    }

    try {
      const affiliate = await getRouloAffiliate(
        existingLink.roulo_username
      );

      if (!affiliate) {
        return NextResponse.json({
          ok: true,
          viewer: viewerUsername,
          platform,
          link: existingLink,
          warning:
            "Roulo username was not found during refresh.",
        });
      }

      const { role, weight } = await getRoleAndWeight({
        rouloUsername: affiliate.rouloUsername,
        existingLink,
      });

      const { data: updatedLink, error: updateError } =
        await supabase
          .from("roulo_links")
          .update({
            wagered: affiliate.wagered,
            role,
            weight,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingLink.id)
          .select("*")
          .single();

      if (updateError) {
        return NextResponse.json({
          ok: false,
          error: updateError.message,
          link: existingLink,
        });
      }

      return NextResponse.json({
        ok: true,
        viewer: viewerUsername,
        platform,
        link: updatedLink,
      });
    } catch (error: any) {
      return NextResponse.json({
        ok: true,
        viewer: viewerUsername,
        platform,
        link: existingLink,
        warning:
          error?.message ||
          "Could not refresh Roulo stats.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error:
        error?.message ||
        "Could not load Roulo link.",
      link: null,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const platform =
      String(body?.platform || "twitch").toLowerCase() ===
      "kick"
        ? "kick"
        : "twitch";

    const twitchUsername = normalize(
      body?.twitch_username || ""
    );

    const twitchDisplayName = String(
      body?.twitch_display_name ||
        twitchUsername ||
        ""
    ).trim();

    const kickUsername = normalize(
      body?.kick_username || ""
    );

    const kickDisplayName = String(
      body?.kick_display_name ||
        kickUsername ||
        ""
    ).trim();

    const viewerUsername =
      platform === "kick"
        ? kickUsername
        : twitchUsername;

    const displayName =
      platform === "kick"
        ? kickDisplayName
        : twitchDisplayName;

    const rouloUsername = normalize(
      body?.roulo_username || ""
    );

    if (!viewerUsername) {
      return NextResponse.json({
        ok: false,
        error: `Missing ${
          platform === "kick" ? "Kick" : "Twitch"
        } username`,
      });
    }

    if (!rouloUsername) {
      return NextResponse.json({
        ok: false,
        error: "Enter your Roulo username.",
      });
    }

    const affiliate = await getRouloAffiliate(
      rouloUsername
    );

    if (!affiliate) {
      return NextResponse.json({
        ok: false,
        error:
          "That Roulo username was not found under your affiliate list.",
      });
    }

    const usernameColumn =
      platform === "kick"
        ? "kick_username"
        : "twitch_username";

    const displayNameColumn =
      platform === "kick"
        ? "kick_display_name"
        : "twitch_display_name";

    const viewerOptions = usernameOptions(viewerUsername);

    const { data: existingLink, error: existingError } =
      await supabase
        .from("roulo_links")
        .select("*")
        .in(usernameColumn, viewerOptions)
        .limit(1)
        .maybeSingle();

    if (existingError) {
      return NextResponse.json({
        ok: false,
        error: existingError.message,
      });
    }

    const { role, weight } = await getRoleAndWeight({
      rouloUsername: affiliate.rouloUsername,
      existingLink,
    });

    const payload: Record<string, any> = {
      [usernameColumn]: viewerUsername,
      [displayNameColumn]: displayName,

      roulo_username: affiliate.rouloUsername,
      wagered: affiliate.wagered,
      role,
      weight,

      discord_id:
        existingLink?.discord_id || null,

      discord_username:
        existingLink?.discord_username || null,

      is_in_discord: Boolean(
        existingLink?.is_in_discord ||
          existingLink?.discord_id ||
          existingLink?.discord_username
      ),

      updated_at: new Date().toISOString(),
    };

    const { data, error } = existingLink?.id
      ? await supabase
          .from("roulo_links")
          .update(payload)
          .eq("id", existingLink.id)
          .select("*")
          .single()
      : await supabase
          .from("roulo_links")
          .insert(payload)
          .select("*")
          .single();

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
      });
    }

    return NextResponse.json({
      ok: true,
      viewer: viewerUsername,
      platform,
      link: data,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error:
        error?.message ||
        "Could not link Roulo account.",
    });
  }
}