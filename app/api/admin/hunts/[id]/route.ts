import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_USERS = ["trashguy__", "trashguy", "parz"];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAuth = createClient(supabaseUrl, publishableKey);

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    return { ok: false, error: "Missing Supabase environment variables." };
  }

  if (!token) {
    return { ok: false, error: "Missing auth token." };
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data?.user) {
    return { ok: false, error: "Invalid Twitch session." };
  }

  const user = data.user;
  const identityData =
    user.identities?.[0]?.identity_data as Record<string, unknown> | undefined;

  const login =
    (user.user_metadata?.preferred_username as string | undefined) ||
    (user.user_metadata?.user_name as string | undefined) ||
    (identityData?.preferred_username as string | undefined) ||
    (identityData?.user_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (identityData?.name as string | undefined) ||
    "";

  if (!ADMIN_USERS.includes(login.toLowerCase())) {
    return { ok: false, error: "Not authorized." };
  }

  return { ok: true, login };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin(req);

    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { action, finalAmount } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing hunt id" }, { status: 400 });
    }

    if (action === "open") {
      const { data, error } = await supabaseAdmin
        .from("hunts")
        .update({
          status: "open",
          opened_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        hunt: data,
      });
    }

    if (action === "lock") {
      const { data, error } = await supabaseAdmin
        .from("hunts")
        .update({
          status: "locked",
          locked_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        hunt: data,
      });
    }

    if (action === "complete") {
      if (typeof finalAmount !== "number" || Number.isNaN(finalAmount)) {
        return NextResponse.json(
          { error: "finalAmount is required" },
          { status: 400 }
        );
      }

      const { data: hunt, error: huntError } = await supabaseAdmin
        .from("hunts")
        .update({
          status: "completed",
          final_amount: finalAmount,
          completed_at: new Date().toISOString(),
          locked_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (huntError || !hunt) {
        return NextResponse.json(
          { error: huntError?.message || "Hunt not found" },
          { status: 500 }
        );
      }

      const { data: predictions, error: predictionsError } = await supabaseAdmin
        .from("predictions")
        .select("guess_amount, profile_id")
        .eq("hunt_id", id);

      if (predictionsError) {
        return NextResponse.json(
          { error: predictionsError.message },
          { status: 500 }
        );
      }

      const winners = (predictions || [])
        .map((prediction) => ({
          profile_id: prediction.profile_id,
          guess_amount: Number(prediction.guess_amount),
          distance: Math.abs(
            Number(prediction.guess_amount) - Number(finalAmount)
          ),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 2)
        .map((winner, index) => ({
          hunt_id: id,
          profile_id: winner.profile_id,
          guess_amount: winner.guess_amount,
          final_amount: finalAmount,
          distance: winner.distance,
          placement: index + 1,
        }));

      const { error: deleteError } = await supabaseAdmin
        .from("prediction_results")
        .delete()
        .eq("hunt_id", id);

      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message },
          { status: 500 }
        );
      }

      if (winners.length > 0) {
        const { error: winnersError } = await supabaseAdmin
          .from("prediction_results")
          .insert(winners);

        if (winnersError) {
          return NextResponse.json(
            { error: winnersError.message },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        hunt,
        winners,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}