import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  const { data, error } = await supabase
    .from("monthly_rewards")
    .select("*")
    .order("reward_date", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rewards: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const rewardDate = String(body.reward_date || "");
  const title = String(body.title || "");
  const amount = Number(body.amount || 0);
  const note = String(body.note || "");

  if (!rewardDate) {
    return NextResponse.json({ ok: false, error: "Missing reward date." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("monthly_rewards")
    .upsert(
      {
        reward_date: rewardDate,
        title,
        amount,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "reward_date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reward: data });
}