import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalizeUsername(value: string) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

function pickWeightedWinner(entries: any[]) {
  const totalWeight = entries.reduce((sum, entry) => {
    return sum + Math.max(1, Number(entry.weight || 1));
  }, 0);

  let random = Math.random() * totalWeight;

  for (const entry of entries) {
    random -= Math.max(1, Number(entry.weight || 1));

    if (random <= 0) return entry;
  }

  return entries[entries.length - 1];
}

export async function POST(req: NextRequest) {
  const amount = Number(req.nextUrl.searchParams.get("amount") || 0);

  const { data: giveaway, error: giveawayError } = await supabase
    .from("chat_giveaways")
    .select("*")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (giveawayError || !giveaway) {
    return NextResponse.json({ ok: false, error: "No live giveaway" });
  }

  const { data: entries, error: entriesError } = await supabase
    .from("chat_giveaway_entries")
    .select("*")
    .eq("giveaway_id", giveaway.id);

  if (entriesError) {
    return NextResponse.json({ ok: false, error: entriesError.message });
  }

  if (!entries || entries.length === 0) {
    return NextResponse.json({ ok: false, error: "No entries" });
  }

  const { data: existingRewards, error: rewardsError } = await supabase
    .from("rewards")
    .select("twitch_username")
    .eq("giveaway_id", giveaway.id);

  if (rewardsError) {
    return NextResponse.json({ ok: false, error: rewardsError.message });
  }

const previousWinners = new Set(
  (existingRewards || []).map((reward: any) =>
    `${reward.platform || "twitch"}:${normalizeUsername(reward.twitch_username)}`
  )
);

  const eligibleEntries = entries.filter((entry) => {
    const username = normalizeUsername(entry.username);
    const platform = entry.platform || "twitch";
return username && !previousWinners.has(`${platform}:${username}`);
  });

  if (eligibleEntries.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "All entries have already won. Start a new giveaway for more winners.",
    });
  }

const entriesWithLuck = await Promise.all(
  eligibleEntries.map(async (entry) => {
    const username = normalizeUsername(entry.username);

    const { data: luckRow } = await supabase
      .from("giveaway_luck")
      .select("luck")
      .eq("twitch_username", username)
      .maybeSingle();

    const baseWeight = Math.max(1, Number(entry.weight || 1));
    const luckOdds = Number(luckRow?.luck || 0);
    const totalWeight = Number((baseWeight + luckOdds).toFixed(2));

    return {
      ...entry,
      base_weight: baseWeight,
      luck_odds: luckOdds,
      weight: totalWeight,
      total_weight: totalWeight,
    };
  })
);

const winner = pickWeightedWinner(entriesWithLuck);

const winnerUsername = normalizeUsername(winner.username);
const winnerPlatform =
  winner.platform === "kick" ? "kick" : "twitch";
const winnerDisplayName =
  winner.display_name || winnerUsername;

/*
  WINNER:
  Find their existing row by username and reset luck to zero.
*/
const { data: existingWinner, error: winnerLookupError } = await supabase
  .from("giveaway_luck")
  .select("*")
  .eq("twitch_username", winnerUsername)
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (winnerLookupError) {
  return NextResponse.json(
    {
      ok: false,
      error: winnerLookupError.message,
    },
    { status: 500 }
  );
}

if (existingWinner?.id) {
  const { error: winnerUpdateError } = await supabase
    .from("giveaway_luck")
    .update({
      platform: winnerPlatform,
      luck: 0,
      win_count: Number(existingWinner.win_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existingWinner.id);

  if (winnerUpdateError) {
    return NextResponse.json(
      {
        ok: false,
        error: winnerUpdateError.message,
      },
      { status: 500 }
    );
  }
} else {
  const { error: winnerInsertError } = await supabase
    .from("giveaway_luck")
    .insert({
      twitch_username: winnerUsername,
      platform: winnerPlatform,
      luck: 0,
      loss_count: 0,
      win_count: 1,
      updated_at: new Date().toISOString(),
    });

  if (winnerInsertError) {
    return NextResponse.json(
      {
        ok: false,
        error: winnerInsertError.message,
      },
      { status: 500 }
    );
  }
}

/*
  LOSERS:
  Remove the winner and make sure each username is only counted once.
*/
const uniqueLosers = Array.from(
  new Map(
    eligibleEntries
      .filter(
        (entry) =>
          normalizeUsername(entry.username) !== winnerUsername
      )
      .map((entry) => [
        normalizeUsername(entry.username),
        entry,
      ])
  ).values()
);

/*
  Add exactly +0.5 luck to each loser.
*/
for (const loser of uniqueLosers) {
  const username = normalizeUsername(loser.username);
  const platform =
    loser.platform === "kick" ? "kick" : "twitch";

  const { data: existingLoser, error: loserLookupError } =
    await supabase
      .from("giveaway_luck")
      .select("*")
      .eq("twitch_username", username)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (loserLookupError) {
    return NextResponse.json(
      {
        ok: false,
        error: loserLookupError.message,
      },
      { status: 500 }
    );
  }

  if (existingLoser?.id) {
    const nextLuck = Number(
      (Number(existingLoser.luck || 0) + 0.5).toFixed(1)
    );

    const { error: loserUpdateError } = await supabase
      .from("giveaway_luck")
      .update({
        platform,
        luck: nextLuck,
        loss_count:
          Number(existingLoser.loss_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingLoser.id);

    if (loserUpdateError) {
      return NextResponse.json(
        {
          ok: false,
          error: loserUpdateError.message,
        },
        { status: 500 }
      );
    }
  } else {
    const { error: loserInsertError } = await supabase
      .from("giveaway_luck")
      .insert({
        twitch_username: username,
        platform,
        luck: 0.5,
        loss_count: 1,
        win_count: 0,
        updated_at: new Date().toISOString(),
      });

    if (loserInsertError) {
      return NextResponse.json(
        {
          ok: false,
          error: loserInsertError.message,
        },
        { status: 500 }
      );
    }
  }
}

const totalWeight = entriesWithLuck.reduce(
  (sum, entry) =>
    sum + Math.max(1, Number(entry.weight || 1)),
  0
);

const { error: giveawayUpdateError } = await supabase
  .from("chat_giveaways")
  .update({
    winner_username: winnerUsername,
    updated_at: new Date().toISOString(),
  })
  .eq("id", giveaway.id);

if (giveawayUpdateError) {
  return NextResponse.json(
    {
      ok: false,
      error: giveawayUpdateError.message,
    },
    { status: 500 }
  );
}

const { data: reward, error: rewardError } = await supabase
  .from("rewards")
  .insert({
    twitch_username: winnerUsername,
    kick_username:
      winnerPlatform === "kick" ? winnerUsername : null,
    twitch_id: winner.twitch_id || null,
    display_name: winnerDisplayName,
    platform: winnerPlatform,
    amount: amount > 0 ? amount : 0,
    title: "Chat Giveaway",
    status: "unclaimed",
    claimed: false,
    paid: false,
    giveaway_id: giveaway.id,
  })
  .select("*")
  .single();

if (rewardError) {
  return NextResponse.json(
    {
      ok: false,
      error: rewardError.message,
    },
    { status: 500 }
  );
}

return NextResponse.json({
  ok: true,
  winner,
  reward,
  amount,
  total_entries: entries.length,
  eligible_entries: entriesWithLuck.length,
  total_weight: totalWeight,
  winner_weight: Number(winner.weight || 1),
  winner_base_weight: Number(
    winner.base_weight || winner.weight || 1
  ),
  winner_luck_odds: Number(winner.luck_odds || 0),
  winner_role: winner.role || "viewer",
  winner_roulo_username:
    winner.roulo_username || null,
});
}