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

function withoutTrailingUnderscores(value: unknown) {
  return normalize(value).replace(/_+$/g, "");
}

function getViewerOptions(value: unknown) {
  return Array.from(
    new Set([
      normalize(value),
      withoutTrailingUnderscores(value),
    ])
  ).filter(Boolean);
}

/* =========================================================
   GET DISCORD LINK
========================================================= */

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

    const viewerOptions = getViewerOptions(viewer);

    const { data, error } = await supabase
      .from("roulo_links")
      .select(
        `
          twitch_username,
          twitch_display_name,
          kick_username,
          kick_display_name,
          roulo_username,
          discord_id,
          discord_username,
          is_in_discord,
          role,
          weight
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

    const hasDiscord = Boolean(
      data?.is_in_discord ||
        data?.discord_id ||
        normalize(data?.discord_username)
    );

    return NextResponse.json({
      ok: true,
      viewer,
      platform,

      link: data
        ? {
            twitch_username:
              data.twitch_username || null,

            twitch_display_name:
              data.twitch_display_name || null,

            kick_username:
              data.kick_username || null,

            kick_display_name:
              data.kick_display_name || null,

            roulo_username:
              data.roulo_username || null,

            discord_id:
              data.discord_id || null,

            discord_username:
              data.discord_username || null,

            is_in_discord: hasDiscord,

            role:
              data.role || "viewer",

            weight:
              Number(data.weight || 1),
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

/* =========================================================
   UNLINK DISCORD
========================================================= */

export async function DELETE(req: NextRequest) {
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
      });
    }

    const usernameColumn =
      platform === "kick"
        ? "kick_username"
        : "twitch_username";

    const viewerOptions = getViewerOptions(viewer);

    /*
     * Find the shared identity row.
     *
     * We do NOT delete this row because it can also
     * contain Twitch, Kick and Roulo information.
     */
    const {
      data: existingLink,
      error: findError,
    } = await supabase
      .from("roulo_links")
      .select("*")
      .in(usernameColumn, viewerOptions)
      .limit(1)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({
        ok: false,
        error: findError.message,
      });
    }

    if (!existingLink) {
      return NextResponse.json({
        ok: true,
        message: "Discord is already unlinked.",
      });
    }

    const hasRoulo = Boolean(
      normalize(existingLink.roulo_username)
    );

    /*
     * Keep the current VIP role.
     *
     * The Prize Portal / Roulo refresh now handles
     * current-LB + previous-LB VIP qualification.
     */
    const isVip =
      normalize(existingLink.role) === "vip";

    /*
     * Recalculate base giveaway weight after removing
     * the Discord bonus:
     *
     * Viewer = 1
     * Roulo  = +1
     * VIP    = +1
     */
    const newWeight =
      1 +
      (hasRoulo ? 1 : 0) +
      (isVip ? 1 : 0);

    const newRole = isVip
      ? "vip"
      : hasRoulo
      ? "affiliate"
      : "viewer";

    const {
      data: updatedLink,
      error: updateError,
    } = await supabase
      .from("roulo_links")
      .update({
        discord_id: null,
        discord_username: null,
        is_in_discord: false,

        role: newRole,
        weight: newWeight,

        updated_at: new Date().toISOString(),
      })
      .eq("id", existingLink.id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({
        ok: false,
        error: updateError.message,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Discord account unlinked.",
      link: updatedLink,
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,

      error:
        error?.message ||
        "Could not unlink Discord account.",
    });
  }
}