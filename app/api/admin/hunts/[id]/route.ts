import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  try {
    const params = await context.params;
const id = params.id;
const externalHuntId = String(id).trim();
    const body = await req.json();
    const { action, finalAmount } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing hunt id" }, { status: 400 });
    }

    // OPEN PREDICTIONS (keep hunt open)
    if (action === "open") {
      const { data, error } = await supabase
        .from("hunts")
        .update({
          status: "open",
          prediction_status: "open",
          opened_at: new Date().toISOString(),
        })
        .eq("external_hunt_id", externalHuntId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, hunt: data });
    }

    // LOCK PREDICTIONS (hunt stays open)
    if (action === "lock") {
      const { data, error } = await supabase
        .from("hunts")
        .update({
          status: "open",
          prediction_status: "locked",
          locked_at: new Date().toISOString(),
        })
        .eq("external_hunt_id", externalHuntId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, hunt: data });
    }

    // COMPLETE HUNT
    if (action === "complete") {
  if (typeof finalAmount !== "number" || Number.isNaN(finalAmount)) {
    return NextResponse.json(
      { error: "finalAmount is required" },
      { status: 400 }
    );
  }

  const { data: hunt, error: huntError } = await supabase
    .from("hunts")
    .update({
      status: "completed",
      prediction_status: "locked",
      final_amount: finalAmount,
      completed_at: new Date().toISOString(),
    })
    .eq("external_hunt_id", externalHuntId)
    .select()
    .single();

  if (huntError || !hunt) {
    return NextResponse.json(
      { error: huntError?.message || "Hunt not found" },
      { status: 500 }
    );
  }

  const { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select("guess_amount, profile_id")
    .eq("hunt_id", hunt.id);

  if (predictionsError) {
    return NextResponse.json(
      { error: predictionsError.message },
      { status: 500 }
    );
  }

  const baseWinners = (predictions || [])
    .map((p) => ({
      profile_id: p.profile_id,
      guess_amount: Number(p.guess_amount),
      distance: Math.abs(Number(p.guess_amount) - Number(finalAmount)),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2)
    .map((winner, index) => ({
      hunt_id: hunt.id,
      profile_id: winner.profile_id,
      guess_amount: winner.guess_amount,
      final_amount: finalAmount,
      distance: winner.distance,
      placement: index + 1,
    }));

  const { error: deleteResultsError } = await supabase
    .from("prediction_results")
    .delete()
    .eq("hunt_id", hunt.id);

  if (deleteResultsError) {
    return NextResponse.json(
      { error: deleteResultsError.message },
      { status: 500 }
    );
  }

  if (baseWinners.length > 0) {
    const { error: winnersError } = await supabase
      .from("prediction_results")
      .insert(baseWinners);

    if (winnersError) {
      return NextResponse.json(
        { error: winnersError.message },
        { status: 500 }
      );
    }
  }

  const winnerProfileIds = baseWinners
    .map((winner) => winner.profile_id)
    .filter(Boolean);

  let usernameMap: Record<string, string> = {};

  if (winnerProfileIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", winnerProfileIds);

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message },
        { status: 500 }
      );
    }

    usernameMap = Object.fromEntries(
      (profiles || []).map((profile: any) => [
        profile.id,
        profile.username || profile.id,
      ])
    );
  }

  const winners = baseWinners.map((winner) => ({
    ...winner,
    username: usernameMap[winner.profile_id] || winner.profile_id,
  }));

  return NextResponse.json({
    success: true,
    hunt,
    winners,
  });
}

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}