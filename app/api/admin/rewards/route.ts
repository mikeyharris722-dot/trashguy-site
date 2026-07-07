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
    return NextResponse.json({
      ok: false,
      error: error.message,
      rewards: [],
    });
  }

  return NextResponse.json({
    ok: true,
    rewards: data || [],
  });
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const body = await req.json();

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing reward id" });
  }

  if (body.action === "delete") {
    const { data, error } = await supabase
      .from("rewards")
      .delete()
      .eq("id", id)
      .select("*");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message });
    }

    return NextResponse.json({ ok: true, deleted: data || [] });
  }

  const updateData: any = {};

  if (body.action === "paid" || body.status === "paid") {
    updateData.claimed = true;
    updateData.paid = true;
    updateData.status = "paid";
    updateData.paid_at = new Date().toISOString();
  }

  if (body.action === "unpaid" || body.status === "claimed") {
    updateData.claimed = true;
    updateData.paid = false;
    updateData.status = "claimed";
    updateData.paid_at = null;
  }

  if (body.amount !== undefined) {
    updateData.amount = Number(body.amount);
  }

  const { data, error } = await supabase
    .from("rewards")
    .update(updateData)
    .eq("id", id)
    .select("*");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message });
  }

  const reward = Array.isArray(data) ? data[0] : data;

  if (!reward) {
    return NextResponse.json({ ok: false, error: "Reward not found." });
  }

  return NextResponse.json({ ok: true, reward });
}