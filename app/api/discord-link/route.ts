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

export async function GET(req: NextRequest) {
  const viewer = normalize(req.nextUrl.searchParams.get("viewer") || "");

  if (!viewer) {
    return NextResponse.json({ ok: false, error: "Missing viewer" });
  }

  const { data, error } = await supabase
    .from("roulo_links")
    .select("twitch_username, discord_id, discord_username, is_in_discord")
    .eq("twitch_username", viewer)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({
    ok: true,
    link: data
      ? {
          twitch_username: data.twitch_username,
          discord_id: data.discord_id,
          discord_username: data.discord_username,
          is_in_discord: !!data.is_in_discord || !!data.discord_id,
        }
      : null,
  });
}