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

async function getSavedRouloBoost(
  username: string,
  platform: string
) {
  const cleanUsername = normalize(username);

  const usernameColumn =
    platform === "kick"
      ? "kick_username"
      : "twitch_username";

  const { data: link, error: linkError } =
    await supabase
      .from("roulo_links")
      .select(
        `
        roulo_username,
        wagered,
        is_in_discord,
        discord_id,
        discord_username
        `
      )
      .eq(usernameColumn, cleanUsername)
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
      rouloUsername: null,
      isInDiscord: false,
      discordUsername: null,
    };
  }

  const rouloUsername = normalize(
    link.roulo_username
  );

  const hasRoulo = Boolean(rouloUsername);

  const hasDiscord = Boolean(
    link.is_in_discord ||
      link.discord_id ||
      link.discord_username
  );

  /*
    Find the newest VIP snapshot period.
  */
  const {
    data: latestSnapshotPeriod,
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
  }

  let isVip = false;

  /*
    A user is VIP only when their linked Roulo
    username exists in the newest snapshot period.
  */
  if (
    rouloUsername &&
    latestSnapshotPeriod?.period_start &&
    latestSnapshotPeriod?.period_end
  ) {
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
        rouloUsername
      )
      .maybeSingle();

    if (vipSnapshotError) {
      console.error(
        "VIP snapshot user lookup failed:",
        vipSnapshotError
      );
    }

    isVip = Boolean(vipSnapshotRow);
  }

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

  return {
    weight,
    role,
    isRouloAffiliate: hasRoulo,
    rouloWagered: Number(
      link.wagered || 0
    ),
    rouloUsername:
      link.roulo_username || null,
    isInDiscord: hasDiscord,
    discordUsername:
      link.discord_username || null,
  };
}

export async function POST(
  req: NextRequest
) {
  try {
    const body = await req.json();

    const username = normalize(
      body.username
    );

    const platform =
      normalize(body.platform) === "kick"
        ? "kick"
        : "twitch";

    if (!username) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing username",
        },
        {
          status: 400,
        }
      );
    }

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
      .select("id, giveaway_type")
      .eq("status", "live")
      .in("giveaway_type", [
        "regular",
        "vip",
      ])
      .order("created_at", {
        ascending: false,
      });

    if (giveawayError) {
      return NextResponse.json(
        {
          ok: false,
          error: giveawayError.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
      Everyone may enter the regular giveaway.

      Only users found in the latest VIP snapshot
      may enter the VIP giveaway.
    */
    const eligibleGiveaways = (
      liveGiveaways || []
    ).filter((giveaway: any) => {
      if (
        giveaway.giveaway_type ===
        "regular"
      ) {
        return true;
      }

      return (
        giveaway.giveaway_type ===
          "vip" &&
        boost.role === "vip"
      );
    });

    if (
      eligibleGiveaways.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            boost.role === "vip"
              ? "No live giveaway"
              : "No live regular giveaway",
        },
        {
          status: 400,
        }
      );
    }

    const savedEntries: any[] = [];

    for (const giveaway of eligibleGiveaways) {
      const {
        data,
        error: entryError,
      } = await supabase
        .from("chat_giveaway_entries")
        .upsert(
          {
            giveaway_id: giveaway.id,
            username,
            display_name:
              body.display_name ||
              username,
            twitch_id:
              body.twitch_id || null,
            avatar_url:
              body.avatar_url || null,
            platform,

            weight: boost.weight,
            role: boost.role,
            is_roulo_affiliate:
              boost.isRouloAffiliate,
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
            error: entryError.message,
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
      entry: savedEntries[0],
      entries: savedEntries,

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

      role: boost.role,
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