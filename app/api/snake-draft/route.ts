import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const DRAFT_ID = "main";

export async function GET() {
  const { data, error } = await supabase
    .from("snake_drafts")
    .select("*")
    .eq("id", DRAFT_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    draft: data?.data || null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { error } = await supabase
    .from("snake_drafts")
    .upsert(
      {
        id: DRAFT_ID,
        data: body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
  });
}