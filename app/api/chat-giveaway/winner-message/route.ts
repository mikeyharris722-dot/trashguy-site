import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: unknown) {
  return String(value || "").replace("@", "").trim().toLowerCase();
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

    const { data: giveaway, error: giveawayError } = await supabase
      .from("chat_giveaways")
      .select("id, winner_username")
      .not("winner_username", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (giveawayError || !giveaway?.id || !giveaway.winner_username) {
      return NextResponse.json({ ok: true, saved: false });
    }

    if (normalize(giveaway.winner_username) !== username) {
      return NextResponse.json({ ok: true, saved: false });
    }

    const { data: winnerEntry } = await supabase
      .from("chat_giveaway_entries")
      .select("platform")
      .eq("giveaway_id", giveaway.id)
      .eq("username", username)
      .limit(1)
      .maybeSingle();

    const winnerPlatform =
      normalize(winnerEntry?.platform) === "kick" ? "kick" : "twitch";

    if (winnerPlatform !== platform) {
      return NextResponse.json({ ok: true, saved: false });
    }

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

    return NextResponse.json({ ok: true, saved: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to save winner message" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data: giveaway, error: giveawayError } = await supabase
      .from("chat_giveaways")
      .select("id, winner_username")
      .not("winner_username", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (giveawayError || !giveaway?.id) {
      return NextResponse.json({ ok: true, messages: [] });
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