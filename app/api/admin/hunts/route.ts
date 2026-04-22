import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, casino, startAmount } = body;

    if (!title || !casino || !startAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const apiKey = process.env.BONUSHUNT_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing BONUSHUNT_API_KEY" },
        { status: 500 }
      );
    }

    // 1) Get latest external BonusHunt hunt
    const externalRes = await fetch("https://bonushunt.gg/api/public/hunts?limit=1", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!externalRes.ok) {
      const text = await externalRes.text();
      return NextResponse.json(
        { error: `BonusHunt API error: ${text}` },
        { status: externalRes.status }
      );
    }

    const externalData = await externalRes.json();

    const latestExternalHunt = Array.isArray(externalData?.hunts)
      ? externalData.hunts[0]
      : Array.isArray(externalData)
      ? externalData[0]
      : null;

    if (!latestExternalHunt?.id) {
      return NextResponse.json(
        { error: "No external hunt found." },
        { status: 500 }
      );
    }

    const externalHuntId = String(latestExternalHunt.id);

    // 2) Check if this external hunt already exists locally
    const { data: existingHunt, error: existingError } = await supabase
      .from("hunts")
      .select("*")
      .eq("external_hunt_id", externalHuntId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    // 3) If exists, reopen/update it instead of creating duplicate rows
    if (existingHunt) {
  // clear old predictions tied to this reused hunt row
  const { error: deletePredictionsError } = await supabase
    .from("predictions")
    .delete()
    .eq("hunt_id", existingHunt.id);

  if (deletePredictionsError) {
    return NextResponse.json(
      { error: deletePredictionsError.message },
      { status: 500 }
    );
  }

  const { error: deleteResultsError } = await supabase
    .from("prediction_results")
    .delete()
    .eq("hunt_id", existingHunt.id);

  if (deleteResultsError) {
    return NextResponse.json(
      { error: deleteResultsError.message },
      { status: 500 }
    );
  }

  const { data: reopenedHunt, error: reopenError } = await supabase
    .from("hunts")
    .update({
      title,
      casino,
      start_amount: Number(startAmount),
      final_amount: null,
      status: "open",
      prediction_status: "open",
      opened_at: new Date().toISOString(),
      locked_at: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existingHunt.id)
    .select()
    .single();

  if (reopenError) {
    return NextResponse.json(
      { error: reopenError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    hunt: {
      ...reopenedHunt,
      id: externalHuntId,
    },
  });
}

    // 4) Otherwise create a new local row linked to the external hunt id
    const { data, error } = await supabase
      .from("hunts")
      .insert({
        external_hunt_id: externalHuntId,
        title,
        casino,
        start_amount: Number(startAmount),
        status: "open",
        prediction_status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        opened_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hunt: {
        ...data,
        id: externalHuntId,
      },
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