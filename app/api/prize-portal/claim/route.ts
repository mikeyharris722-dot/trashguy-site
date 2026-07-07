import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: string) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  const id = String(body?.id || "").trim();
  const viewer = normalize(body?.viewer || "");
  const platform = body?.platform === "kick" ? "kick" : "twitch";
  const usernameColumn = platform === "kick" ? "kick_username" : "twitch_username";

  if (!id || !viewer) {
    return NextResponse.json({ ok: false, error: "Missing reward id or viewer." });
  }

  const { data, error } = await supabase
    .from("rewards")
    .update({
      claimed: true,
      paid: false,
      claimed_at: new Date().toISOString(),
      status: "claimed",
    })
    .eq("id", id)
    .eq(usernameColumn, viewer)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true, reward: data });
}