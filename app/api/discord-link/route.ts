import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: string) {
  return String(value || "")
    .replace("@", "")
    .trim()
    .toLowerCase();
}

function withoutTrailingUnderscores(value: string) {
  return normalize(value).replace(/_+$/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const viewer = normalize(
      req.nextUrl.searchParams.get("viewer") || ""
    );

    const platform =
      req.nextUrl.searchParams.get("platform") === "kick"
        ? "kick"
        : "twitch";

    if (!viewer) {
      return NextResponse.json({
        ok: false,
        error: "Missing viewer",
        link: null,
      });
    }

    const usernameColumn =
      platform === "kick"
        ? "kick_username"
        : "twitch_username";

    const viewerOptions = Array.from(
      new Set([
        viewer,
        withoutTrailingUnderscores(viewer),
      ])
    ).filter(Boolean);

    const { data, error } = await supabase
      .from("roulo_links")
      .select(
        `
          twitch_username,
          twitch_display_name,
          kick_username,
          kick_display_name,
          discord_id,
          discord_username,
          is_in_discord
        `
      )
      .in(usernameColumn, viewerOptions)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        link: null,
      });
    }

    const hasDiscord =
      !!data?.is_in_discord ||
      !!data?.discord_id ||
      !!data?.discord_username;

    return NextResponse.json({
      ok: true,
      viewer,
      platform,
      link: data
        ? {
            twitch_username: data.twitch_username || null,
            twitch_display_name:
              data.twitch_display_name || null,

            kick_username: data.kick_username || null,
            kick_display_name:
              data.kick_display_name || null,

            discord_id: data.discord_id || null,
            discord_username:
              data.discord_username || null,

            is_in_discord: hasDiscord,
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error:
        error?.message ||
        "Could not load Discord link.",
      link: null,
    });
  }
}