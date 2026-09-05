import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const CURRENT_LB_START = "2026-09-05";
const CURRENT_LB_END = "2026-10-05";
const LIFETIME_START = "2024-01-01";

const VIP_WAGER_REQUIREMENT = 5000;

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

function getRawWager(player: any) {
  return Number(
    player?.wagered_amount ??
      player?.wageredAmount ??
      player?.wagered ??
      player?.amount ??
      0
  );
}

function getWeightedWager(player: any) {
  return Number(
    player?.weighted_wagered_amount ??
      player?.weightedWageredAmount ??
      player?.weighted_wagered ??
      player?.wagered_amount ??
      player?.wageredAmount ??
      player?.wagered ??
      0
  );
}

function extractAffiliates(json: any) {
  return Array.isArray(json)
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
}

async function fetchRouloAffiliates({
  startAt,
  endAt,
  weighted,
}: {
  startAt: string;
  endAt: string;
  weighted: boolean;
}) {
  const key = process.env.ROULO_API_KEY;

  if (!key) {
    throw new Error("Missing ROULO_API_KEY");
  }

  const url = new URL(
    "https://api.roulobets.com/v1/external/affiliates"
  );

  url.searchParams.set("start_at", startAt);
  url.searchParams.set("end_at", endAt);
  url.searchParams.set("key", key);
  url.searchParams.set(
    "weighted",
    weighted ? "true" : "false"
  );

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();

    throw new Error(
      `Roulo API returned ${res.status}: ${text}`
    );
  }

  const json = await res.json();

  return extractAffiliates(json);
}

function findAffiliate(
  affiliates: any[],
  rouloUsername: string
) {
  const target = normalize(rouloUsername);

  return (
    affiliates.find(
      (player: any) =>
        getPlayerName(player) === target
    ) || null
  );
}

async function getRouloStats(
  rouloUsername: string
) {
  if (!rouloUsername) {
    return {
      lifetimeWagered: 0,
      leaderboardWagered: 0,
      leaderboardWeightedWagered: 0,
    };
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const [
    lifetimeAffiliates,
    leaderboardAffiliates,
    weightedLeaderboardAffiliates,
  ] = await Promise.all([
    /*
     * Lifetime RAW wager.
     */
    fetchRouloAffiliates({
      startAt: LIFETIME_START,
      endAt: today,
      weighted: false,
    }),

    /*
     * Current leaderboard RAW wager.
     */
    fetchRouloAffiliates({
      startAt: CURRENT_LB_START,
      endAt: CURRENT_LB_END,
      weighted: false,
    }),

    /*
     * Current leaderboard WEIGHTED wager.
     */
    fetchRouloAffiliates({
      startAt: CURRENT_LB_START,
      endAt: CURRENT_LB_END,
      weighted: true,
    }),
  ]);

  const lifetimePlayer = findAffiliate(
    lifetimeAffiliates,
    rouloUsername
  );

  const leaderboardPlayer = findAffiliate(
    leaderboardAffiliates,
    rouloUsername
  );

  const weightedPlayer = findAffiliate(
    weightedLeaderboardAffiliates,
    rouloUsername
  );

  const lifetimeWagered = lifetimePlayer
    ? getRawWager(lifetimePlayer)
    : 0;

  const leaderboardWagered = leaderboardPlayer
    ? getRawWager(leaderboardPlayer)
    : 0;

  const leaderboardWeightedWagered =
    weightedPlayer
      ? getWeightedWager(weightedPlayer)
      : 0;

  return {
    lifetimeWagered:
      Number.isFinite(lifetimeWagered)
        ? lifetimeWagered
        : 0,

    leaderboardWagered:
      Number.isFinite(leaderboardWagered)
        ? leaderboardWagered
        : 0,

    leaderboardWeightedWagered:
      Number.isFinite(
        leaderboardWeightedWagered
      )
        ? leaderboardWeightedWagered
        : 0,
  };
}

async function getPreviousLeaderboardVip(
  rouloUsername: string
) {
  if (!rouloUsername) return false;

  /*
   * Latest snapshot = VIP qualification earned
   * from the previous leaderboard.
   */
  const { data: latestSnapshot, error } =
    await supabase
      .from("vip_snapshots")
      .select("period_start, period_end")
      .order("period_end", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "VIP snapshot period lookup failed:",
      error
    );

    return false;
  }

  if (!latestSnapshot) {
    return false;
  }

  const { data: vipRow, error: vipError } =
    await supabase
      .from("vip_snapshots")
      .select("id")
      .eq(
        "roulo_username",
        normalize(rouloUsername)
      )
      .eq(
        "period_start",
        latestSnapshot.period_start
      )
      .eq(
        "period_end",
        latestSnapshot.period_end
      )
      .limit(1)
      .maybeSingle();

  if (vipError) {
    console.error(
      "VIP snapshot lookup failed:",
      vipError
    );

    return false;
  }

  return Boolean(vipRow);
}

export async function GET(
  req: NextRequest
) {
  try {
    const rawViewer = normalize(
      req.nextUrl.searchParams.get(
        "viewer"
      ) ||
        req.headers.get(
          "x-viewer-name"
        ) ||
        ""
    );

    const platform =
      req.nextUrl.searchParams.get(
        "platform"
      ) === "kick"
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

        lifetimeWagered: 0,
        leaderboardWagered: 0,
        leaderboardWeightedWagered: 0,

        vipRequirement:
          VIP_WAGER_REQUIREMENT,

        previousLeaderboardVip: false,
        currentLeaderboardVip: false,
        isVip: false,
      });
    }

    const viewerOptions =
      uniqueUsernames(rawViewer);

    /*
     * Load the viewer's full identity row.
     */
    const {
      data: identityRow,
      error: identityError,
    } = await supabase
      .from("roulo_links")
      .select("*")
      .in(
        usernameColumn,
        viewerOptions
      )
      .limit(1)
      .maybeSingle();

    if (identityError) {
      console.error(
        "Prize portal identity lookup failed:",
        identityError
      );
    }

    /*
     * Build every known Twitch/Kick username
     * variation for this viewer.
     */
    const twitchOptions =
      uniqueUsernames(
        platform === "twitch"
          ? rawViewer
          : "",

        identityRow?.twitch_username,
        identityRow?.twitch_display_name
      );

    const kickOptions =
      uniqueUsernames(
        platform === "kick"
          ? rawViewer
          : "",

        identityRow?.kick_username,
        identityRow?.kick_display_name
      );

    const rewardUsernames =
      platform === "kick"
        ? kickOptions
        : twitchOptions;

    const safeRewardUsernames =
      rewardUsernames.length > 0
        ? rewardUsernames
        : viewerOptions;

    /*
     * Load all prizes for the logged-in viewer.
     */
    const {
      data: rewardData,
      error: rewardError,
    } = await supabase
      .from("rewards")
      .select("*")
      .in(
        usernameColumn,
        safeRewardUsernames
      )
      .order("created_at", {
        ascending: false,
      });

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

        lifetimeWagered: 0,
        leaderboardWagered: 0,
        leaderboardWeightedWagered: 0,

        vipRequirement:
          VIP_WAGER_REQUIREMENT,
      });
    }

    const rewards =
      rewardData || [];

    const totalUnclaimed = rewards
      .filter(
        (reward: any) =>
          !reward.claimed &&
          !reward.paid
      )
      .reduce(
        (
          sum: number,
          reward: any
        ) =>
          sum +
          Number(
            reward.amount || 0
          ),
        0
      );

    const totalClaimed = rewards
      .filter(
        (reward: any) =>
          reward.claimed &&
          !reward.paid
      )
      .reduce(
        (
          sum: number,
          reward: any
        ) =>
          sum +
          Number(
            reward.amount || 0
          ),
        0
      );

    const totalPaid = rewards
      .filter(
        (reward: any) =>
          reward.paid
      )
      .reduce(
        (
          sum: number,
          reward: any
        ) =>
          sum +
          Number(
            reward.amount || 0
          ),
        0
      );

    /*
     * LINK STATUS
     */
    const rouloUsername =
      normalize(
        identityRow?.roulo_username
      );

    const hasRoulo =
      Boolean(rouloUsername);

    const hasDiscord = Boolean(
      identityRow?.is_in_discord ||
        identityRow?.discord_id ||
        normalize(
          identityRow?.discord_username
        )
    );

    /*
     * LOAD WAGER STATS
     */
    let lifetimeWagered = 0;
    let leaderboardWagered = 0;
    let leaderboardWeightedWagered =
      0;

    let rouloStatsError = "";

    if (hasRoulo) {
      try {
        const stats =
          await getRouloStats(
            rouloUsername
          );

        lifetimeWagered =
          stats.lifetimeWagered;

        leaderboardWagered =
          stats.leaderboardWagered;

        leaderboardWeightedWagered =
          stats.leaderboardWeightedWagered;
      } catch (error: any) {
        console.error(
          "Prize portal Roulo stats failed:",
          error
        );

        rouloStatsError =
          error?.message ||
          "Could not refresh wager stats.";

        /*
         * Existing wagered is still useful
         * as a fallback for lifetime wager.
         */
        lifetimeWagered =
          Number(
            identityRow?.wagered || 0
          );
      }
    }

    /*
     * VIP QUALIFICATION
     *
     * Previous LB VIP
     * OR
     * current weighted wager >= $5,000
     */
    const previousLeaderboardVip =
      hasRoulo
        ? await getPreviousLeaderboardVip(
            rouloUsername
          )
        : false;

    const currentLeaderboardVip =
      leaderboardWeightedWagered >=
      VIP_WAGER_REQUIREMENT;

    const isVip =
      previousLeaderboardVip ||
      currentLeaderboardVip;

    /*
     * Keep roulo_links updated too.
     *
     * This means the viewer's profile/status
     * immediately reflects their current VIP.
     */
    if (
      identityRow?.id &&
      hasRoulo
    ) {
      const weight =
        1 +
        1 +
        (hasDiscord ? 1 : 0) +
        (isVip ? 1 : 0);

      const role = isVip
        ? "vip"
        : "affiliate";

      const {
        error: updateRoleError,
      } = await supabase
        .from("roulo_links")
        .update({
          wagered:
            lifetimeWagered,

          role,

          weight,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          identityRow.id
        );

      if (updateRoleError) {
        console.error(
          "Prize portal role update failed:",
          updateRoleError
        );
      }
    }

    /*
     * GIVEAWAY LUCK
     */
    const luckViewerOptions =
      uniqueUsernames(
        identityRow?.twitch_username,
        identityRow?.twitch_display_name,

        platform === "twitch"
          ? rawViewer
          : ""
      );

    let luckRow: any = null;

    if (
      luckViewerOptions.length > 0
    ) {
      const {
        data: foundLuckRow,
        error: luckError,
      } = await supabase
        .from("giveaway_luck")
        .select("*")
        .in(
          "twitch_username",
          luckViewerOptions
        )
        .limit(1)
        .maybeSingle();

      if (luckError) {
        console.error(
          "Prize portal luck lookup failed:",
          luckError
        );
      } else {
        luckRow =
          foundLuckRow;
      }
    }

    /*
     * GIVEAWAY ODDS
     *
     * Viewer       = 1
     * Roulo        = +1
     * Discord      = +1
     * VIP          = +1
     * Luck         = saved separately
     */
    const rouloBonus =
      hasRoulo ? 1 : 0;

    const discordBonus =
      hasDiscord ? 1 : 0;

    const vipBonus =
      isVip ? 1 : 0;

    const baseOdds = Number(
      (
        1 +
        rouloBonus +
        discordBonus +
        vipBonus
      ).toFixed(2)
    );

    const luckOdds = Number(
      Number(
        luckRow?.luck || 0
      ).toFixed(2)
    );

    const totalOdds = Number(
      (
        baseOdds +
        luckOdds
      ).toFixed(2)
    );

    const nextOdds = Number(
      (
        totalOdds + 1
      ).toFixed(2)
    );

    return NextResponse.json({
      ok: true,

      viewer: rawViewer,
      platform,
      viewerOptions,

      /*
       * PROFILE IDENTITY
       */
      identity: identityRow
        ? {
            twitchUsername:
              identityRow.twitch_username ||
              null,

            twitchDisplayName:
              identityRow.twitch_display_name ||
              null,

            kickUsername:
              identityRow.kick_username ||
              null,

            kickDisplayName:
              identityRow.kick_display_name ||
              null,

            rouloUsername:
              identityRow.roulo_username ||
              null,

            discordUsername:
              identityRow.discord_username ||
              null,

            role: isVip
              ? "vip"
              : hasRoulo
              ? "affiliate"
              : "viewer",
          }
        : null,

      /*
       * PRIZES
       */
      rewards,

      totalUnclaimed,
      totalClaimed,

      totalPending:
        totalClaimed,

      totalPaid,

      /*
       * LINK STATUS
       */
      hasRoulo,
      hasDiscord,

      /*
       * VIP STATUS
       */
      isVip,

      previousLeaderboardVip,
      currentLeaderboardVip,

      vipRequirement:
        VIP_WAGER_REQUIREMENT,

      /*
       * WAGER STATS
       */
      lifetimeWagered,

      leaderboardWagered,

      leaderboardWeightedWagered,

      amountUntilVip: Math.max(
        0,
        VIP_WAGER_REQUIREMENT -
          leaderboardWeightedWagered
      ),

      /*
       * ODDS
       */
      rouloBonus,
      discordBonus,
      vipBonus,

      baseOdds,
      luckOdds,
      totalOdds,
      nextOdds,

      lossCount: Number(
        luckRow?.loss_count || 0
      ),

      winCount: Number(
        luckRow?.win_count || 0
      ),

      ...(rouloStatsError
        ? {
            rouloStatsWarning:
              rouloStatsError,
          }
        : {}),
    });
  } catch (error: any) {
    console.error(
      "Prize portal GET failed:",
      error
    );

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

      lifetimeWagered: 0,
      leaderboardWagered: 0,
      leaderboardWeightedWagered: 0,

      vipRequirement:
        VIP_WAGER_REQUIREMENT,

      previousLeaderboardVip: false,
      currentLeaderboardVip: false,
      isVip: false,
    });
  }
}