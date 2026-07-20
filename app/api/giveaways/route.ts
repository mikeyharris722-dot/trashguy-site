import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function cleanUsername(value: unknown) {
  return String(value || "").replace("@", "").trim();
}

function getRewardDate(reward: any) {
  return (
    reward?.paid_at ||
    reward?.updated_at ||
    reward?.claimed_at ||
    reward?.created_at ||
    new Date(0).toISOString()
  );
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const key = url.searchParams.get("key");
    const user = url.searchParams.get("user");
    const amountRaw = url.searchParams.get("amount");
    const note = url.searchParams.get("note") || "";

    /*
     * Nightbot save mode
     *
     * This remains unchanged. A request containing key, user or amount
     * is treated as a request to save a new legacy giveaway.
     */
    if (key || user || amountRaw) {
      if (key !== process.env.GIVEAWAY_API_KEY) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const winnerName = cleanUsername(user);
      const amount = Number(amountRaw || 0);

      if (!winnerName) {
        return NextResponse.json(
          { error: "Missing winner name" },
          { status: 400 }
        );
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Invalid amount" },
          { status: 400 }
        );
      }

      const { error } = await supabase.from("giveaways").insert({
        winner_name: winnerName,
        amount,
        note: note || null,
        source: "nightbot",
      });

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return new NextResponse(`${winnerName} won $${amount}`, {
        status: 200,
      });
    }

    /*
     * Website load mode
     *
     * Load both:
     * 1. Existing legacy giveaways
     * 2. Rewards that have been marked paid in the Prize Portal
     */
    const [legacyResult, paidRewardsResult] = await Promise.all([
      supabase
        .from("giveaways")
        .select("id, winner_name, amount, note, source, created_at")
        .order("created_at", { ascending: false }),

      supabase
        .from("rewards")
        .select("*")
        .eq("paid", true)
        .order("created_at", { ascending: false }),
    ]);

    const errors: string[] = [];

    if (legacyResult.error) {
      errors.push(`Giveaways: ${legacyResult.error.message}`);
    }

    if (paidRewardsResult.error) {
      errors.push(`Paid rewards: ${paidRewardsResult.error.message}`);
    }

    const legacyGiveaways = (legacyResult.data || []).map((giveaway: any) => ({
      id: `giveaway-${giveaway.id}`,
      original_id: giveaway.id,
      winner_name: cleanUsername(giveaway.winner_name),
      amount: Number(giveaway.amount || 0),
      note: giveaway.note || null,
      source: giveaway.source || "giveaways",
      created_at: giveaway.created_at,
    }));

    const paidRewards = (paidRewardsResult.data || [])
      .map((reward: any) => {
        const winnerName = cleanUsername(
          reward.twitch_username ||
            reward.kick_username ||
            reward.username ||
            reward.winner_name
        );

        return {
          id: `reward-${reward.id}`,
          original_id: reward.id,
          winner_name: winnerName,
          amount: Number(reward.amount || 0),
          note:
            reward.note ||
            reward.description ||
            reward.reward_type ||
            reward.type ||
            null,
          source: "prize-portal",
          created_at: getRewardDate(reward),
        };
      })
      .filter((reward: any) => {
        return (
          reward.winner_name &&
          Number.isFinite(reward.amount) &&
          reward.amount > 0
        );
      });

    /*
     * IDs are prefixed by source so a giveaway ID and reward ID can
     * never collide in React.
     *
     * We intentionally do not remove two different prizes merely because
     * they have the same username and amount. A viewer may legitimately
     * win the same amount more than once.
     */
    const combinedGiveaways = [...legacyGiveaways, ...paidRewards];

    combinedGiveaways.sort((a: any, b: any) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();

      return bTime - aTime;
    });

    const total = combinedGiveaways.reduce(
      (sum: number, giveaway: any) =>
        sum + Number(giveaway.amount || 0),
      0
    );

    return NextResponse.json({
      success: true,
      giveaways: combinedGiveaways,
      total,
      legacyCount: legacyGiveaways.length,
      paidRewardCount: paidRewards.length,
      ...(errors.length > 0 ? { note: errors.join(" | ") } : {}),
    });
  } catch (error: any) {
    console.error("Giveaways GET failed:", error);

    return NextResponse.json({
      success: true,
      giveaways: [],
      total: 0,
      note: error?.message || "Failed to load giveaways",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const key = url.searchParams.get("key") || "";
    const user = url.searchParams.get("user") || "";
    const amountRaw = url.searchParams.get("amount") || "";
    const note = url.searchParams.get("note") || "";

    if (key !== process.env.GIVEAWAY_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const winnerName = cleanUsername(user);
    const amount = Number(amountRaw);

    if (!winnerName) {
      return NextResponse.json(
        { error: "Missing winner name" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("giveaways")
      .insert({
        winner_name: winnerName,
        amount,
        note: note || null,
        source: "nightbot",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${winnerName} won $${amount}`,
      giveaway: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to save giveaway",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const key = url.searchParams.get("key");
    const id = url.searchParams.get("id");

    if (key !== process.env.GIVEAWAY_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "Missing id" },
        { status: 400 }
      );
    }

    const cleanId = id.replace(/^giveaway-/, "");

    const { error } = await supabase
      .from("giveaways")
      .delete()
      .eq("id", cleanId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Delete failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const key = url.searchParams.get("key");
    const id = url.searchParams.get("id");

    if (key !== process.env.GIVEAWAY_API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: "Missing id" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const winnerName = cleanUsername(body?.winner_name);
    const amount = Number(body?.amount);
    const note = String(body?.note || "").trim();

    if (!winnerName) {
      return NextResponse.json(
        { error: "Missing winner name" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const cleanId = id.replace(/^giveaway-/, "");

    const { error } = await supabase
      .from("giveaways")
      .update({
        winner_name: winnerName,
        amount,
        note: note || null,
      })
      .eq("id", cleanId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Update failed" },
      { status: 500 }
    );
  }
}