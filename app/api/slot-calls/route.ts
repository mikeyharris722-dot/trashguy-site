import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  const { data, error } = await supabase
    .from("slot_calls")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    calls: data || [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const username = String(body.username || "").trim();
  const slotName = String(body.slotName || body.slot_name || "").trim();
  const platform = String(body.platform || "twitch").trim();

  if (!username || !slotName) {
    return NextResponse.json({ error: "Missing username or slot name" }, { status: 400 });
  }

  const { data: existingUser } = await supabase
    .from("slot_calls")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: `${username} already has a slot on the wheel.` }, { status: 400 });
  }

  const { data: existingSlot } = await supabase
    .from("slot_calls")
    .select("id")
    .ilike("slot_name", slotName)
    .maybeSingle();

  if (existingSlot) {
    return NextResponse.json({ error: `${slotName} is already on the wheel.` }, { status: 400 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, call: data });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing slot call id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("slot_calls")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}