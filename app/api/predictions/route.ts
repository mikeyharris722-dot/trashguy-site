import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("predictions")
      .select("id, profile_id, guess_amount, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({
        success: true,
        predictions: [],
        note: error.message,
      });
    }

    const predictions = (data || []).map((row) => ({
      id: row.id,
      username: row.profile_id,
      guess: Number(row.guess_amount || 0),
      created_at: row.updated_at || row.created_at,
    }));

    return NextResponse.json({
      success: true,
      predictions,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      predictions: [],
      note: error?.message || "Failed to load predictions",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body?.username || "").trim();
    const guessAmount = Number(body?.guessAmount || 0);

    if (!username || !guessAmount || Number.isNaN(guessAmount)) {
      return NextResponse.json(
        { error: "Missing username or guessAmount" },
        { status: 400 }
      );
    }

    const { data: activeHunt, error: huntError } = await supabase
      .from("hunts")
      .select("id, status")
      .in("status", ["open"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (huntError) {
      return NextResponse.json({ error: huntError.message }, { status: 500 });
    }

    if (!activeHunt?.id) {
      return NextResponse.json(
        { error: "No open hunt found." },
        { status: 400 }
      );
    }

    const payload = {
      hunt_id: activeHunt.id,
      profile_id: username,
      guess_amount: guessAmount,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabase
      .from("predictions")
      .select("id")
      .eq("hunt_id", activeHunt.id)
      .eq("profile_id", username)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existing?.id) {
      const { data, error } = await supabase
        .from("predictions")
        .update({
          guess_amount: guessAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        prediction: data,
      });
    }

    const { data, error } = await supabase
      .from("predictions")
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      prediction: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}