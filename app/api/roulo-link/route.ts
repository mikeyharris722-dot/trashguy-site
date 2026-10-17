import {profileWagerStats} from "@/lib/profile-wagers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/review-client";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);



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

async function getRouloStats(rouloUsername: string) {
  const stats = await profileWagerStats(rouloUsername);
  if (stats.warning || stats.lifetimeWagered === null || stats.leaderboardWagered === null || stats.leaderboardWeightedWagered === null)
    throw Error(stats.warning || 'Wager stats are temporarily unavailable.');
  return stats.found ? {...stats, lifetimeWagered:stats.lifetimeWagered, leaderboardWagered:stats.leaderboardWagered, leaderboardWeightedWagered:stats.leaderboardWeightedWagered} : null;
}

async function isPreviousLeaderboardVip(
  rouloUsername: string
) {
  const cleanRouloUsername = normalize(
    rouloUsername
  );

  if (!cleanRouloUsername) {
    return false;
  }

  const {
    data: latestSnapshot,
    error: latestSnapshotError,
  } = await supabase
    .from("vip_snapshots")
    .select("period_start, period_end")
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
    !latestSnapshot?.period_start ||
    !latestSnapshot?.period_end
  ) {
    return false;
  }

  const {
    data: vipSnapshot,
    error: vipSnapshotError,
  } = await supabase
    .from("vip_snapshots")
    .select("roulo_username, wagered")
    .eq(
      "period_start",
      latestSnapshot.period_start
    )
    .eq(
      "period_end",
      latestSnapshot.period_end
    )
    .ilike(
      "roulo_username",
      cleanRouloUsername
    )
    .limit(1)
    .maybeSingle();

  if (vipSnapshotError) {
    console.error(
      "Previous VIP snapshot lookup failed:",
      vipSnapshotError
    );

    return false;
  }

  return Boolean(vipSnapshot);
}

async function getRoleAndWeight({
  rouloUsername,
  currentWeightedWagered,
  existingLink,
}: {
  rouloUsername: string;
  currentWeightedWagered: number;
  existingLink?: any;
}) {
  const previousLeaderboardVip =
    await isPreviousLeaderboardVip(
      rouloUsername
    );

  const currentLeaderboardVip =
    Number(currentWeightedWagered || 0) >=
    VIP_WAGER_REQUIREMENT;

  const isVip =
    previousLeaderboardVip ||
    currentLeaderboardVip;

  const isOnCode = Boolean(
    normalize(rouloUsername)
  );

  const isInDiscord = Boolean(
    existingLink?.is_in_discord ||
      existingLink?.discord_id ||
      existingLink?.discord_username
  );

  const weight =
    1 +
    (isOnCode ? 1 : 0) +
    (isInDiscord ? 1 : 0) +
    (isVip ? 1 : 0);

  const role = isVip
    ? "vip"
    : isOnCode
    ? "affiliate"
    : "viewer";

  return {
    role,
    weight: Number(weight.toFixed(2)),

    isVip,
    previousLeaderboardVip,
    currentLeaderboardVip,
  };
}

async function buildUpdatedLink(
  existingLink: any,
  stats: any
) {
  const roleInfo =
    await getRoleAndWeight({
      rouloUsername:
        stats.rouloUsername,

      currentWeightedWagered:
        stats.leaderboardWeightedWagered,

      existingLink,
    });

  return {
    roleInfo,

    payload: {
      wagered: stats.lifetimeWagered,

      role: roleInfo.role,
      weight: roleInfo.weight,

      updated_at:
        new Date().toISOString(),
    },
  };
}

/* =========================================================
   GET LINK + REFRESH STATS
========================================================= */

export async function GET(
  req: NextRequest
) {
  try {
    const platform =
      req.nextUrl.searchParams.get(
        "platform"
      ) === "kick"
        ? "kick"
        : "twitch";

    const legacyTwitchUsername =
      normalize(
        req.nextUrl.searchParams.get(
          "twitch"
        ) || ""
      );

    const viewerUsername = normalize(
      req.nextUrl.searchParams.get(
        "viewer"
      ) || legacyTwitchUsername
    );

    if (!viewerUsername) {
      return NextResponse.json({
        ok: false,
        error: `Missing ${
          platform === "kick"
            ? "Kick"
            : "Twitch"
        } username`,
        link: null,
      });
    }

    const usernameColumn =
      platform === "kick"
        ? "kick_username"
        : "twitch_username";

    const viewerOptions =
      usernameOptions(viewerUsername);

    const {
      data: existingLink,
      error,
    } = await supabase
      .from("roulo_links")
      .select("*")
      .in(
        usernameColumn,
        viewerOptions
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        link: null,
      });
    }

    if (
      !existingLink?.roulo_username
    ) {
      return NextResponse.json({
        ok: true,
        viewer: viewerUsername,
        platform,
        link: existingLink || null,

        stats: {
          lifetimeWagered: 0,
          leaderboardWagered: 0,
          leaderboardWeightedWagered: 0,
          vipRequirement:
            VIP_WAGER_REQUIREMENT,
          currentLeaderboardVip: false,
          previousLeaderboardVip: false,
          isVip: false,
        },
      });
    }

    try {
      const stats =
        await getRouloStats(
          existingLink.roulo_username
        );

      if (!stats) {
        return NextResponse.json({ok:true,viewer:viewerUsername,platform,link:existingLink,stats:null,
          warning:'Roulo username was not found during refresh. Saved figures were preserved.'});
      }

      const {
        payload,
        roleInfo,
      } = await buildUpdatedLink(
        existingLink,
        stats
      );

      const {
        data: updatedLink,
        error: updateError,
      } = await supabase
        .from("roulo_links")
        .update(payload)
        .eq("id", existingLink.id)
        .select("*")
        .single();

      if (updateError) {
        return NextResponse.json({
          ok: false,
          error:
            updateError.message,
          link: existingLink,
        });
      }

      return NextResponse.json({
        ok: true,
        viewer: viewerUsername,
        platform,

        link: updatedLink,

        stats: {
          lifetimeWagered:
            stats.lifetimeWagered,

          leaderboardWagered:
            stats.leaderboardWagered,

          leaderboardWeightedWagered:
            stats.leaderboardWeightedWagered,

          vipRequirement:
            VIP_WAGER_REQUIREMENT,

          previousLeaderboardVip:
            roleInfo.previousLeaderboardVip,

          currentLeaderboardVip:
            roleInfo.currentLeaderboardVip,

          isVip: roleInfo.isVip,
        },
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

/* =========================================================
   LINK ROULO ACCOUNT
========================================================= */

export async function POST(
  req: NextRequest
) {
  try {
    const body = await req.json();

    const platform =
      String(
        body?.platform || "twitch"
      ).toLowerCase() === "kick"
        ? "kick"
        : "twitch";

    const twitchUsername =
      normalize(
        body?.twitch_username || ""
      );

    const twitchDisplayName =
      String(
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

    const rouloUsername =
      normalize(
        body?.roulo_username || ""
      );

    if (!viewerUsername) {
      return NextResponse.json({
        ok: false,
        error: `Missing ${
          platform === "kick"
            ? "Kick"
            : "Twitch"
        } username`,
      });
    }

    if (!rouloUsername) {
      return NextResponse.json({
        ok: false,
        error:
          "Enter your Roulo username.",
      });
    }

    const stats =
      await getRouloStats(
        rouloUsername
      );

    if (!stats) {
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

    const viewerOptions =
      usernameOptions(viewerUsername);

    const {
      data: existingLink,
      error: existingError,
    } = await supabase
      .from("roulo_links")
      .select("*")
      .in(
        usernameColumn,
        viewerOptions
      )
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({
        ok: false,
        error:
          existingError.message,
      });
    }

    const roleInfo =
      await getRoleAndWeight({
        rouloUsername:
          stats.rouloUsername,

        currentWeightedWagered:
          stats.leaderboardWeightedWagered,

        existingLink,
      });

    const payload: Record<
      string,
      any
    > = {
      [usernameColumn]:
        viewerUsername,

      [displayNameColumn]:
        displayName,

      roulo_username:
        stats.rouloUsername,

      wagered:
        stats.lifetimeWagered,

      role: roleInfo.role,
      weight: roleInfo.weight,

      discord_id:
        existingLink?.discord_id ||
        null,

      discord_username:
        existingLink?.discord_username ||
        null,

      is_in_discord: Boolean(
        existingLink?.is_in_discord ||
          existingLink?.discord_id ||
          existingLink?.discord_username
      ),

      updated_at:
        new Date().toISOString(),
    };

    const { data, error } =
      existingLink?.id
        ? await supabase
            .from("roulo_links")
            .update(payload)
            .eq(
              "id",
              existingLink.id
            )
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

      stats: {
        lifetimeWagered:
          stats.lifetimeWagered,

        leaderboardWagered:
          stats.leaderboardWagered,

        leaderboardWeightedWagered:
          stats.leaderboardWeightedWagered,

        vipRequirement:
          VIP_WAGER_REQUIREMENT,

        previousLeaderboardVip:
          roleInfo.previousLeaderboardVip,

        currentLeaderboardVip:
          roleInfo.currentLeaderboardVip,

        isVip: roleInfo.isVip,
      },
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

/* =========================================================
   UNLINK ROULO ACCOUNT
========================================================= */

export async function DELETE(
  req: NextRequest
) {
  try {
    const platform =
      req.nextUrl.searchParams.get(
        "platform"
      ) === "kick"
        ? "kick"
        : "twitch";

    const viewer = normalize(
      req.nextUrl.searchParams.get(
        "viewer"
      ) || ""
    );

    if (!viewer) {
      return NextResponse.json({
        ok: false,
        error: "Missing viewer",
      });
    }

    const usernameColumn =
      platform === "kick"
        ? "kick_username"
        : "twitch_username";

    const viewerOptions =
      usernameOptions(viewer);

    const {
      data: existingLink,
      error: findError,
    } = await supabase
      .from("roulo_links")
      .select("*")
      .in(
        usernameColumn,
        viewerOptions
      )
      .limit(1)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({
        ok: false,
        error:
          findError.message,
      });
    }

    if (!existingLink) {
      return NextResponse.json({
        ok: true,
      });
    }

    /*
     * Do not delete the entire roulo_links row.
     * Twitch/Kick/Discord can all live on this row.
     */
    const hasDiscord = Boolean(
      existingLink.is_in_discord ||
        existingLink.discord_id ||
        existingLink.discord_username
    );

    const newWeight =
      1 + (hasDiscord ? 1 : 0);

    const {
      data,
      error,
    } = await supabase
      .from("roulo_links")
      .update({
        roulo_username: null,
        wagered: 0,

        role: "viewer",
        weight: newWeight,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", existingLink.id)
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
      link: data,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error:
        error?.message ||
        "Could not unlink Roulo account.",
    });
  }
}