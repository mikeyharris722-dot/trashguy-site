import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: string) {
  return String(value || "")
    .replace("@", "")
    .trim()
    .toLowerCase();
}

function withoutTrailingUnderscores(value: string) {
  return normalize(value).replace(/_+$/g, "");
}

export async function GET(req: NextRequest) {
  const rawViewer = normalize(
    req.nextUrl.searchParams.get("viewer") ||
      req.headers.get("x-viewer-name") ||
      ""
  );

  if (!rawViewer) {
    return NextResponse.json({
      ok: false,
      error: "Missing viewer",
      rewards: [],
      totalPending: 0,
      totalPaid: 0,
    });
  }

  const viewerOptions = Array.from(
    new Set([
      rawViewer,
      withoutTrailingUnderscores(rawViewer),
    ])
  );

  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .in("twitch_username", viewerOptions)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({
      ok: false,
      error: error.message,
      rewards: [],
      totalPending: 0,
      totalPaid: 0,
    });
  }

  const rewards = data || [];

  const totalPending = rewards
    .filter((reward: any) => reward.status === "pending")
    .reduce((sum: number, reward: any) => sum + Number(reward.amount || 0), 0);

  const totalPaid = rewards
    .filter((reward: any) => reward.status === "paid")
    .reduce((sum: number, reward: any) => sum + Number(reward.amount || 0), 0);

  return NextResponse.json({
    ok: true,
    viewer: rawViewer,
    viewerOptions,
    rewards,
    totalPending,
    totalPaid,
  });
}