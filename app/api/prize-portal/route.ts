import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function uniqueUsernames(...values: unknown[]) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => [
          normalize(value),
          withoutTrailingUnderscores(value),
        ])
        .filter(Boolean)
    )
  );
}

export async function GET(req: NextRequest) {
  try {
    const rawViewer = normalize(
      req.nextUrl.searchParams.get("viewer") ||
        req.headers.get("x-viewer-name") ||
        ""
    );

    const platform =
      req.nextUrl.searchParams.get("platform") === "kick"
        ? "kick"
        : "twitch";

    const usernameColumn =
      platform === "kick"
        ? "kick_username"
        : "twitch_username";

    if (!rawViewer) {
      return NextResponse.json({
        ok: false,
        error: "Missing viewer",
        rewards: [],
        totalUnclaimed: 0,
        totalClaimed: 0,
        totalPending: 0,
        totalPaid: 0,
        baseOdds: 1,
        luckOdds: 0,
        totalOdds: 1,
        nextOdds: 2,
        lossCount: 0,
        winCount: 0,
      });
    }

    const viewerOptions = uniqueUsernames(rawViewer);

    /*
     * Load the viewer's identity row first.
     *
     * This row may contain Twitch, Kick, Discord, VIP, and Roulo
     * information. None of the bonuses require roulo_username to exist.
     */
    const { data: identityRow, error: identityError } = await supabase
      .from("roulo_links")
      .select(
        `
          twitch_username,
          twitch_display_name,
          kick_username,
          kick_display_name,
          roulo_username,
          discord_id,
          discord_username,
          is_in_discord,
          role
        `
      )
      .in(usernameColumn, viewerOptions)
      .limit(1)
      .maybeSingle();

    if (identityError) {
      console.error("Prize portal identity lookup failed:", identityError);
    }

    /*
     * Include all known usernames for this viewer.
     *
     * This helps when usernames differ slightly between saved rows,
     * such as trailing underscores.
     */
    const twitchOptions = uniqueUsernames(
      platform === "twitch" ? rawViewer : "",
      identityRow?.twitch_username,
      identityRow?.twitch_display_name
    );

    const kickOptions = uniqueUsernames(
      platform === "kick" ? rawViewer : "",
      identityRow?.kick_username,
      identityRow?.kick_display_name
    );

    /*
     * Load rewards using the platform the viewer is currently signed
     * in with.
     */
    const rewardUsernames =
      platform === "kick" ? kickOptions : twitchOptions;

    const safeRewardUsernames =
      rewardUsernames.length > 0 ? rewardUsernames : viewerOptions;

    const { data: rewardData, error: rewardError } = await supabase
      .from("rewards")
      .select("*")
      .in(usernameColumn, safeRewardUsernames)
      .order("created_at", { ascending: false });

    if (rewardError) {
      return NextResponse.json({
        ok: false,
        error: rewardError.message,
        rewards: [],
        totalUnclaimed: 0,
        totalClaimed: 0,
        totalPending: 0,
        totalPaid: 0,
        baseOdds: 1,
        luckOdds: 0,
        totalOdds: 1,
        nextOdds: 2,
        lossCount: 0,
        winCount: 0,
      });
    }

    const rewards = rewardData || [];

    const totalUnclaimed = rewards
      .filter((reward: any) => !reward.claimed && !reward.paid)
      .reduce(
        (sum: number, reward: any) =>
          sum + Number(reward.amount || 0),
        0
      );

    const totalClaimed = rewards
      .filter((reward: any) => reward.claimed && !reward.paid)
      .reduce(
        (sum: number, reward: any) =>
          sum + Number(reward.amount || 0),
        0
      );

    const totalPaid = rewards
      .filter((reward: any) => reward.paid)
      .reduce(
        (sum: number, reward: any) =>
          sum + Number(reward.amount || 0),
        0
      );

    /*
     * Independent bonus checks
     *
     * Roulo does not control Discord or VIP.
     */
    const hasRoulo = Boolean(
      normalize(identityRow?.roulo_username)
    );

    const hasDiscord = Boolean(
      identityRow?.is_in_discord ||
        identityRow?.discord_id ||
        normalize(identityRow?.discord_username)
    );

    const savedRole = normalize(identityRow?.role);
    const isVip = savedRole === "vip";

    /*
     * giveaway_luck currently uses twitch_username.
     *
     * For a Kick viewer linked to Twitch, use the linked Twitch username.
     * For a Kick-only viewer, the portal still loads all independent base
     * bonuses, but saved luck requires a matching giveaway_luck identity.
     */
    const luckViewerOptions = uniqueUsernames(
      identityRow?.twitch_username,
      identityRow?.twitch_display_name,
      platform === "twitch" ? rawViewer : ""
    );

    let luckRow: any = null;

    if (luckViewerOptions.length > 0) {
      const { data: foundLuckRow, error: luckError } = await supabase
        .from("giveaway_luck")
        .select("*")
        .in("twitch_username", luckViewerOptions)
        .limit(1)
        .maybeSingle();

      if (luckError) {
        console.error("Prize portal luck lookup failed:", luckError);
      } else {
        luckRow = foundLuckRow;
      }
    }

    /*
     * Current odds values:
     *
     * Base viewer odds: 1
     * Roulo:           +1
     * Discord:         +1
     * VIP:             +1
     * Luck:            saved separately
     */
    const rouloBonus = hasRoulo ? 1 : 0;
    const discordBonus = hasDiscord ? 1 : 0;
    const vipBonus = isVip ? 1 : 0;

    const baseOdds = Number(
      (
        1 +
        rouloBonus +
        discordBonus +
        vipBonus
      ).toFixed(2)
    );

    const luckOdds = Number(
      Number(luckRow?.luck || 0).toFixed(2)
    );

    const totalOdds = Number(
      (baseOdds + luckOdds).toFixed(2)
    );

    const nextOdds = Number(
      (totalOdds + 1).toFixed(2)
    );

    return NextResponse.json({
      ok: true,

      viewer: rawViewer,
      platform,
      viewerOptions,

      rewards,

      totalUnclaimed,
      totalClaimed,
      totalPending: totalClaimed,
      totalPaid,

      hasRoulo,
      hasDiscord,
      isVip,

      rouloBonus,
      discordBonus,
      vipBonus,

      baseOdds,
      luckOdds,
      totalOdds,
      nextOdds,

      lossCount: Number(luckRow?.loss_count || 0),
      winCount: Number(luckRow?.win_count || 0),
    });
  } catch (error: any) {
    console.error("Prize portal GET failed:", error);

    return NextResponse.json({
      ok: false,
      error:
        error?.message ||
        "Could not load the Prize Portal.",
      rewards: [],
      totalUnclaimed: 0,
      totalClaimed: 0,
      totalPending: 0,
      totalPaid: 0,
      baseOdds: 1,
      luckOdds: 0,
      totalOdds: 1,
      nextOdds: 2,
      lossCount: 0,
      winCount: 0,
    });
  }
}