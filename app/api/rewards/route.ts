import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  const { data: rewards, error } = await supabase
    .from("rewards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const usernames = Array.from(
    new Set(
      (rewards || [])
        .flatMap((reward: any) => [
          reward.twitch_username,
          reward.kick_username,
        ])
        .filter(Boolean)
        .map((name: string) => name.toLowerCase())
    )
  );

  let rouloMap = new Map<string, string>();

  if (usernames.length) {
    const { data: links } = await supabase
      .from("roulo_links")
      .select("twitch_username, kick_username, roulo_username");

    (links || []).forEach((link: any) => {
      if (link.twitch_username) {
        rouloMap.set(
          String(link.twitch_username).toLowerCase(),
          link.roulo_username
        );
      }

      if (link.kick_username) {
        rouloMap.set(
          String(link.kick_username).toLowerCase(),
          link.roulo_username
        );
      }
    });
  }

  const enrichedRewards = (rewards || []).map((reward: any) => ({
    ...reward,
    roulo_username:
      rouloMap.get(
        String(
          reward.kick_username || reward.twitch_username || ""
        ).toLowerCase()
      ) || null,
  }));

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