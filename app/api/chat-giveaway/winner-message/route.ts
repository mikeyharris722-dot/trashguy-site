import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

type GiveawayType = "regular" | "vip";

function normalize(value: unknown) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

function getGiveawayType(req: NextRequest): GiveawayType {
  return req.nextUrl.searchParams.get("type") === "vip" ? "vip" : "regular";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = normalize(body.username);
    const displayName = String(body.displayName || body.username || "").trim();
    const platform = normalize(body.platform) === "kick" ? "kick" : "twitch";
    const message = String(body.message || "").trim();

    if (!username || !message) {
      return NextResponse.json(
        { ok: false, error: "Missing username or message" },
        { status: 400 }
      );
    }

    const { data: candidateGiveaways, error: giveawayError } = await supabase
      .from("chat_giveaways")
      .select("id, winner_username, giveaway_type, finished_at")
      .in("giveaway_type", ["regular", "vip"])
      .not("winner_username", "is", null)
      .order("finished_at", { ascending: false })
      .limit(10);

    if (giveawayError) {
      return NextResponse.json(
        { ok: false, error: giveawayError.message },
        { status: 500 }
      );
    }

    const latestByType = new Map<string, any>();

    for (const giveaway of candidateGiveaways || []) {
      if (!latestByType.has(giveaway.giveaway_type)) {
        latestByType.set(giveaway.giveaway_type, giveaway);
      }
    }

    let savedCount = 0;

    for (const giveaway of latestByType.values()) {
      if (normalize(giveaway.winner_username) !== username) continue;

      const { data: winnerEntry, error: entryError } = await supabase
        .from("chat_giveaway_entries")
        .select("platform")
        .eq("giveaway_id", giveaway.id)
        .eq("username", username)
        .limit(1)
        .maybeSingle();

      if (entryError) {
        return NextResponse.json(
          { ok: false, error: entryError.message },
          { status: 500 }
        );
      }

      const winnerPlatform =
        normalize(winnerEntry?.platform) === "kick" ? "kick" : "twitch";

      if (winnerPlatform !== platform) continue;

      const { error } = await supabase
        .from("chat_giveaway_winner_messages")
        .insert({
          giveaway_id: giveaway.id,
          username,
          display_name: displayName || username,
          platform,
          message,
        });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      savedCount += 1;
    }

    return NextResponse.json({ ok: true, saved: savedCount > 0, savedCount });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to save winner message" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const giveawayType = getGiveawayType(req);

    const { data: giveaway, error: giveawayError } = await supabase
      .from("chat_giveaways")
      .select("id, winner_username, giveaway_type")
      .eq("giveaway_type", giveawayType)
      .not("winner_username", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (giveawayError || !giveaway?.id) {
      return NextResponse.json({
        ok: true,
        giveawayType,
        winnerUsername: "",
        messages: [],
      });
    }

    const { data, error } = await supabase
      .from("chat_giveaway_winner_messages")
      .select("id, username, display_name, platform, message, created_at")
      .eq("giveaway_id", giveaway.id)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      giveawayType,
      winnerUsername: normalize(giveaway.winner_username),
      messages: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load winner messages" },
      { status: 500 }
    );
  }
}
