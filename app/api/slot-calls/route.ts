import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  const [
    { data: calls, error: callsError },
    { data: results, error: resultsError },
  ] = await Promise.all([
    supabase
      .from("slot_calls")
      .select("*")
      .order("created_at", { ascending: true }),

    supabase
      .from("slot_call_results")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  if (callsError) {
    return NextResponse.json(
      { error: callsError.message },
      { status: 500 }
    );
  }

  if (resultsError) {
    return NextResponse.json(
      { error: resultsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    calls: calls || [],
    results: results || [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const action = String(body.action || "").trim();

  /*
    SAVE A ROLLED RESULT + PAYOUT
  */
  if (action === "saveResult") {
    const username = String(body.username || "").trim();
    const slotName = String(
      body.slotName || body.slot_name || ""
    ).trim();

    const platform = String(
      body.platform || "twitch"
    ).trim();

    const payout = Number(body.payout);

    if (!username || !slotName) {
      return NextResponse.json(
        {
          error: "Missing username or slot name",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(payout) || payout < 0) {
      return NextResponse.json(
        {
          error: "Invalid payout amount",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("slot_call_results")
      .insert({
        username,
        slot_name: slotName,
        platform,
        payout,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: data,
    });
  }

  /*
    NORMAL SLOT CALL ENTRY
  */
  const username = String(body.username || "").trim();

  const slotName = String(
    body.slotName || body.slot_name || ""
  ).trim();

  const platform = String(
    body.platform || "twitch"
  ).trim();

  if (!username || !slotName) {
    return NextResponse.json(
      {
        error: "Missing username or slot name",
      },
      { status: 400 }
    );
  }

  const { data: existingUser } = await supabase
    .from("slot_calls")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json(
      {
        error: `${username} already has a slot on the wheel.`,
      },
      { status: 400 }
    );
  }

  const { data: existingSlot } = await supabase
    .from("slot_calls")
    .select("id")
    .ilike("slot_name", slotName)
    .maybeSingle();

  if (existingSlot) {
    return NextResponse.json(
      {
        error: `${slotName} is already on the wheel.`,
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("slot_calls")
    .insert({
      username,
      slot_name: slotName,
      platform,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    call: data,
  });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  const clearAll =
    req.nextUrl.searchParams.get("clearAll") === "true";

  const resultId =
    req.nextUrl.searchParams.get("resultId");

  const clearResults =
    req.nextUrl.searchParams.get("clearResults") === "true";

  /*
    CLEAR ALL CURRENT WHEEL ENTRIES
  */
  if (clearAll) {
    const { error } = await supabase
      .from("slot_calls")
      .delete()
      .not("id", "is", null);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      cleared: true,
    });
  }

  /*
    CLEAR ALL ROLLED RESULTS
  */
  if (clearResults) {
    const { error } = await supabase
      .from("slot_call_results")
      .delete()
      .not("id", "is", null);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      resultsCleared: true,
    });
  }

  /*
    DELETE ONE ROLLED RESULT
  */
  if (resultId) {
    const { error } = await supabase
      .from("slot_call_results")
      .delete()
      .eq("id", resultId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      resultDeleted: true,
    });
  }

  /*
    DELETE ONE CURRENT SLOT CALL
  */
  if (!id) {
    return NextResponse.json(
      {
        error: "Missing slot call id",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("slot_calls")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
  });
}