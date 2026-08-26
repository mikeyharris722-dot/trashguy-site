import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const CURRENT_LB_START = "2026-08-05";
const CURRENT_LB_END = "2026-09-05";
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

function usernameOptions(value: unknown) {
  return Array.from(
    new Set([
      normalize(value),
      withoutTrailingUnderscores(value),
    ])
  ).filter(Boolean);
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

/* =========================================================
   CURRENT LEADERBOARD WEIGHTED WAGER
========================================================= */

async function getCurrentWeightedWager(
  rouloUsername: string
) {
  const cleanRouloUsername = normalize(
    rouloUsername
  );

  if (!cleanRouloUsername) {
    return 0;
  }

  const key = process.env.ROULO_API_KEY;

  if (!key) {
    console.error(
      "Giveaway entry VIP check: Missing ROULO_API_KEY"
    );

    return 0;
  }

  try {
    const url = new URL(
      "https://api.roulobets.com/v1/external/affiliates"
    );

    url.searchParams.set(
      "start_at",
      CURRENT_LB_START
    );

    url.searchParams.set(
      "end_at",
      CURRENT_LB_END
    );

    url.searchParams.set("key", key);

    url.searchParams.set(
      "weighted",
      "true"
    );

    const res = await fetch(
      url.toString(),
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.error(
        "Giveaway entry Roulo weighted lookup failed:",
        res.status
      );

      return 0;
    }

    const json = await res.json();

    const affiliates = Array.isArray(json)
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
      : Array.isArray(
          json?.data?.affiliates
        )
      ? json.data.affiliates
      : Array.isArray(
          json?.data?.results
        )
      ? json.data.results
      : [];

    const match =
      affiliates.find(
        (player: any) =>
          getPlayerName(player) ===
          cleanRouloUsername
      ) || null;

    if (!match) {
      return 0;
    }

    const weightedWager =
      getWeightedWager(match);

    return Number.isFinite(
      weightedWager
    )
      ? weightedWager
      : 0;
  } catch (error) {
    console.error(
      "Giveaway entry current weighted wager lookup failed:",
      error
    );

    return 0;
  }
}

/* =========================================================
   PREVIOUS LEADERBOARD VIP
========================================================= */

async function getPreviousLeaderboardVip(
  rouloUsername: string
) {
  const cleanRouloUsername =
    normalize(rouloUsername);

  if (!cleanRouloUsername) {
    return false;
  }

  const {
    data: latestSnapshotPeriod,
    error: latestSnapshotError,
  } = await supabase
    .from("vip_snapshots")
    .select(
      "period_start, period_end"
    )
    .order("period_end", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (latestSnapshotError) {
    console.error(
      "Latest VIP snapshot lookup failed:",
      latestSnapshotError
    );

    return false;
  }

  if (
    !latestSnapshotPeriod?.period_start ||
    !latestSnapshotPeriod?.period_end
  ) {
    return false;
  }

  const {
    data: vipSnapshotRow,
    error: vipSnapshotError,
  } = await supabase
    .from("vip_snapshots")
    .select("roulo_username")
    .eq(
      "period_start",
      latestSnapshotPeriod.period_start
    )
    .eq(
      "period_end",
      latestSnapshotPeriod.period_end
    )
    .ilike(
      "roulo_username",
      cleanRouloUsername
    )
    .limit(1)
    .maybeSingle();

  if (vipSnapshotError) {
    console.error(
      "VIP snapshot user lookup failed:",
      vipSnapshotError
    );

    return false;
  }

  return Boolean(vipSnapshotRow);
}

/* =========================================================
   BUILD GIVEAWAY BOOST
========================================================= */

async function getSavedRouloBoost(
  username: string,
  platform: string
) {
  const cleanUsername =
    normalize(username);

  const usernameColumn =
    platform === "kick"
      ? "kick_username"
      : "twitch_username";

  const viewerOptions =
    usernameOptions(cleanUsername);

  const {
    data: link,
    error: linkError,
  } = await supabase
    .from("roulo_links")
    .select(
      `
        id,
        twitch_username,
        kick_username,
        roulo_username,
        wagered,
        role,
        weight,
        is_in_discord,
        discord_id,
        discord_username
      `
    )
    .in(
      usernameColumn,
      viewerOptions
    )
    .limit(1)
    .maybeSingle();

  if (linkError) {
    console.error(
      "Roulo link lookup failed:",
      linkError
    );
  }

  if (!link) {
    return {
      weight: 1,
      role: "viewer",

      isRouloAffiliate: false,

      rouloWagered: 0,

      currentWeightedWagered: 0,

      rouloUsername: null,

      isInDiscord: false,

      discordUsername: null,

      previousLeaderboardVip: false,

      currentLeaderboardVip: false,

      isVip: false,
    };
  }

  const rouloUsername =
    normalize(
      link.roulo_username
    );

  const hasRoulo =
    Boolean(rouloUsername);

  const hasDiscord =
    Boolean(
      link.is_in_discord ||
        link.discord_id ||
        link.discord_username
    );

  /*
   * FINAL VIP RULE
   *
   * VIP if:
   *
   * 1. They qualified from the previous leaderboard
   *
   * OR
   *
   * 2. They currently have $5,000+
   *    weighted wager during this leaderboard.
   */

  let previousLeaderboardVip =
    false;

  let currentWeightedWagered =
    0;

  if (hasRoulo) {
    [
      previousLeaderboardVip,
      currentWeightedWagered,
    ] = await Promise.all([
      getPreviousLeaderboardVip(
        rouloUsername
      ),

      getCurrentWeightedWager(
        rouloUsername
      ),
    ]);
  }

  const currentLeaderboardVip =
    currentWeightedWagered >=
    VIP_WAGER_REQUIREMENT;

  const isVip =
    previousLeaderboardVip ||
    currentLeaderboardVip;

  const role = isVip
    ? "vip"
    : hasRoulo
    ? "affiliate"
    : "viewer";

  const weight = Number(
    (
      1 +
      (hasRoulo ? 1 : 0) +
      (hasDiscord ? 1 : 0) +
      (isVip ? 1 : 0)
    ).toFixed(2)
  );

  /*
   * Keep roulo_links role + weight fresh.
   *
   * This means someone can become VIP simply
   * by entering a giveaway after crossing $5K.
   */
  if (link.id) {
    const {
      error: updateError,
    } = await supabase
      .from("roulo_links")
      .update({
        role,
        weight,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", link.id);

    if (updateError) {
      console.error(
        "Giveaway entry role refresh failed:",
        updateError
      );
    }
  }

  return {
    weight,
    role,

    isRouloAffiliate:
      hasRoulo,

    rouloWagered:
      Number(link.wagered || 0),

    currentWeightedWagered,

    rouloUsername:
      link.roulo_username ||
      null,

    isInDiscord:
      hasDiscord,

    discordUsername:
      link.discord_username ||
      null,

    previousLeaderboardVip,

    currentLeaderboardVip,

    isVip,
  };
}

/* =========================================================
   ENTER GIVEAWAY
========================================================= */

export async function POST(
  req: NextRequest
) {
  try {
    const body =
      await req.json();

    const username =
      normalize(
        body.username
      );

    const platform =
      normalize(
        body.platform
      ) === "kick"
        ? "kick"
        : "twitch";

    if (!username) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing username",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Refresh their actual current
     * Roulo/VIP status BEFORE deciding
     * which giveaways they can enter.
     */
    const boost =
      await getSavedRouloBoost(
        username,
        platform
      );

    const {
      data: liveGiveaways,
      error: giveawayError,
    } = await supabase
      .from("chat_giveaways")
      .select(
        "id, giveaway_type"
      )
      .eq(
        "status",
        "live"
      )
      .in(
        "giveaway_type",
        [
          "regular",
          "vip",
        ]
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (giveawayError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            giveawayError.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Everyone may enter regular.
     *
     * VIP giveaway eligibility now uses:
     *
     * Previous LB VIP
     * OR
     * Current LB weighted >= $5K
     */
    const eligibleGiveaways =
      (
        liveGiveaways || []
      ).filter(
        (giveaway: any) => {
          if (
            giveaway.giveaway_type ===
            "regular"
          ) {
            return true;
          }

          return (
            giveaway.giveaway_type ===
              "vip" &&
            boost.isVip
          );
        }
      );

    if (
      eligibleGiveaways.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            boost.isVip
              ? "No live giveaway"
              : "No live regular giveaway",
        },
        {
          status: 400,
        }
      );
    }

    const savedEntries: any[] =
      [];

    for (
      const giveaway of
      eligibleGiveaways
    ) {
      const {
        data,
        error: entryError,
      } = await supabase
        .from(
          "chat_giveaway_entries"
        )
        .upsert(
          {
            giveaway_id:
              giveaway.id,

            username,

            display_name:
              body.display_name ||
              username,

            twitch_id:
              body.twitch_id ||
              null,

            avatar_url:
              body.avatar_url ||
              null,

            platform,

            /*
             * BASE WEIGHT AT ENTRY TIME
             */
            weight:
              boost.weight,

            role:
              boost.role,

            is_roulo_affiliate:
              boost.isRouloAffiliate,

            /*
             * Existing lifetime value.
             */
            roulo_wagered:
              boost.rouloWagered,

            roulo_username:
              boost.rouloUsername,

            is_in_discord:
              boost.isInDiscord,

            discord_username:
              boost.discordUsername,
          },
          {
            onConflict:
              "giveaway_id,username",
          }
        )
        .select("*")
        .single();

      if (entryError) {
        return NextResponse.json(
          {
            ok: false,
            error:
              entryError.message,
          },
          {
            status: 500,
          }
        );
      }

      savedEntries.push({
        ...data,

        giveaway_type:
          giveaway.giveaway_type,
      });
    }

    return NextResponse.json({
      ok: true,

      entry:
        savedEntries[0],

      entries:
        savedEntries,

      enteredRegular:
        savedEntries.some(
          (entry) =>
            entry.giveaway_type ===
            "regular"
        ),

      enteredVip:
        savedEntries.some(
          (entry) =>
            entry.giveaway_type ===
            "vip"
        ),

      /*
       * Useful debugging/profile info.
       */
      role:
        boost.role,

      weight:
        boost.weight,

      isVip:
        boost.isVip,

      previousLeaderboardVip:
        boost.previousLeaderboardVip,

      currentLeaderboardVip:
        boost.currentLeaderboardVip,

      currentWeightedWagered:
        boost.currentWeightedWagered,

      vipRequirement:
        VIP_WAGER_REQUIREMENT,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error?.message ||
          "Failed to enter giveaway",
      },
      {
        status: 500,
      }
    );
  }
}