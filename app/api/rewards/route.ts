import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rewards: data || [] });
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const body = await req.json();

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing reward id" });
  }

  // 🔥 DELETE HANDLER
if (body.action === "delete") {
  const { data: rewardToDelete, error: findError } = await supabase
    .from("rewards")
    .select("*")
    .eq("id", id)
    .single();

  if (findError || !rewardToDelete) {
    return NextResponse.json({
      ok: false,
      error: "Reward not found.",
    });
  }

  const deleteQuery = rewardToDelete.giveaway_id
    ? supabase.from("rewards").delete().eq("giveaway_id", rewardToDelete.giveaway_id)
    : supabase.from("rewards").delete().eq("id", id);

  const { data, error } = await deleteQuery.select("*");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({
    ok: true,
    deleted: data || [],
  });
}

  // 🔥 UPDATE HANDLER
  const updates: any = {};

  if (body.status !== undefined) {
    updates.status = body.status;
    updates.paid_at =
      body.status === "complete" ? new Date().toISOString() : null;
  }

  if (body.amount !== undefined) {
    updates.amount = Number(body.amount);
  }

  const { data, error } = await supabase
    .from("rewards")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true, reward: data });
}