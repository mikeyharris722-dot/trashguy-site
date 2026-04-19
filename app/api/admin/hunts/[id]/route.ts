import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, finalAmount } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing hunt id" }, { status: 400 });
    }

    if (action === "open") {
      const { data, error } = await supabase
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

      return NextResponse.json({ success: true, hunt: data });
    }

    if (action === "lock") {
      const { data, error } = await supabase
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

      return NextResponse.json({ success: true, hunt: data });
    }

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
          final_amount: finalAmount,
          completed_at: new Date().toISOString(),
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

      const { data: predictions, error: predictionsError } = await supabase
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
        .map((p) => ({
          profile_id: p.profile_id,
          guess_amount: Number(p.guess_amount),
          distance: Math.abs(Number(p.guess_amount) - Number(finalAmount)),
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

      await supabase.from("prediction_results").delete().eq("hunt_id", id);

      if (winners.length > 0) {
        const { error: winnersError } = await supabase
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
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}