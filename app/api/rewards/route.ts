import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  const normalize = (value: unknown) =>
    String(value || "")
      .replace("@", "")
      .trim()
      .toLowerCase();

  const { data: rewards, error: rewardsError } = await supabase
    .from("rewards")
    .select("*")
    .order("created_at", { ascending: false });

  if (rewardsError) {
    return NextResponse.json(
      {
        ok: false,
        error: rewardsError.message,
        rewards: [],
      },
      { status: 500 }
    );
  }

  const { data: links, error: linksError } = await supabase
    .from("roulo_links")
    .select(
      "twitch_username, twitch_display_name, kick_username, kick_display_name, roulo_username"
    );

  if (linksError) {
    return NextResponse.json(
      {
        ok: false,
        error: linksError.message,
        rewards: [],
      },
      { status: 500 }
    );
  }

  const rouloMap = new Map<string, string>();

  for (const link of links || []) {
    const rouloUsername = String(link.roulo_username || "").trim();

    if (!rouloUsername) continue;

    const possibleNames = [
      link.twitch_username,
      link.twitch_display_name,
      link.kick_username,
      link.kick_display_name,
    ];

    for (const name of possibleNames) {
      const key = normalize(name);

      if (key) {
        rouloMap.set(key, rouloUsername);
      }
    }
  }

  const enrichedRewards = (rewards || []).map((reward: any) => {
    const possibleRewardNames = [
      reward.twitch_username,
      reward.kick_username,
      reward.display_name,
    ];

    let rouloUsername: string | null = null;

    for (const name of possibleRewardNames) {
      const key = normalize(name);
      const match = key ? rouloMap.get(key) : null;

      if (match) {
        rouloUsername = match;
        break;
      }
    }

    return {
      ...reward,
      roulo_username: rouloUsername,
    };
  });

  return NextResponse.json({
    ok: true,
    rewards: enrichedRewards,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const username = String(body.username || "")
    .replace("@", "")
    .trim()
    .toLowerCase();

  const displayName = String(body.displayName || username).trim();
  const platform = body.platform === "kick" ? "kick" : "twitch";
  const amount = Number(body.amount || 0);
  const type = String(body.type || "discord_giveaway");
  const title = String(body.title || "Discord Giveaway").trim();

  if (!username || !amount || amount <= 0) {
    return NextResponse.json({
      ok: false,
      error: "Username and amount are required.",
    });
  }

  const { data, error } = await supabase
    .from("rewards")
.insert({
  twitch_username: username,
  kick_username: platform === "kick" ? username : null,
  display_name: displayName,
  platform,
  amount,
  type,
  title,
  status: "unclaimed",
  claimed: false,
  paid: false,
})
    .select("*");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({
    ok: true,
    reward: Array.isArray(data) ? data[0] : data,
  });
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const body = await req.json();

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing reward id" });
  }

  if (body.action === "delete") {
    const { data, error } = await supabase
      .from("rewards")
      .delete()
      .eq("id", id)
      .select("*");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({ ok: true, deleted: data || [] });
  }

  const updateData: any = {};

  if (body.action === "paid" || body.status === "paid") {
    updateData.claimed = true;
    updateData.paid = true;
    updateData.status = "paid";
    updateData.paid_at = new Date().toISOString();
  }

  if (body.action === "unpaid" || body.status === "claimed") {
    updateData.claimed = true;
    updateData.paid = false;
    updateData.status = "claimed";
    updateData.paid_at = null;
  }

  if (body.amount !== undefined) {
    updateData.amount = Number(body.amount);
  }

const { data, error } = await supabase
  .from("rewards")
  .update(updateData)
  .eq("id", id)
  .select("*");

if (error) {
  return NextResponse.json({ ok: false, error: error.message });
}

const reward = Array.isArray(data) ? data[0] : data;

if (!reward) {
  return NextResponse.json({ ok: false, error: "Reward not found." });
}

return NextResponse.json({ ok: true, reward });
}