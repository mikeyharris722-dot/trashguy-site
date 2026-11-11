import { NextRequest, NextResponse } from "next/server";
import { enterChatGiveaway } from "@/lib/chat-giveaway-entry";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    return await enterChatGiveaway(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid giveaway entry" }, { status: 400 });
  }
}
