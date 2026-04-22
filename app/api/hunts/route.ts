import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  try {
    const apiKey = process.env.BONUSHUNT_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        hunts: [],
        note: "Missing BONUSHUNT_API_KEY",
      });
    }

    // 1) Get external BonusHunt data
    const res = await fetch("https://bonushunt.gg/api/public/hunts?limit=10", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();

      return NextResponse.json({
        success: true,
        hunts: [],
        note: `BonusHunt API error: ${text}`,
      });
    }

    const data = await res.json();

    const externalHunts = Array.isArray(data?.hunts)
      ? data.hunts
      : Array.isArray(data)
        ? data
        : [];

    // 2) Get your local Supabase hunt state
    const { data: localHunts, error: localError } = await supabase
      .from("hunts")
      .select("id, status, prediction_status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (localError) {
      return NextResponse.json({
        success: true,
        hunts: [],
        note: localError.message,
      });
    }

    const localMap = new Map(
      (localHunts || []).map((hunt: any) => [hunt.id, hunt])
    );

    // 3) Merge external hunt data with local DB state
    const hunts = externalHunts.map((hunt: any) => {
      const local = localMap.get(hunt.id);

      return {
        ...hunt,
        status: local?.status || hunt.status || "",
        prediction_status: local?.prediction_status || "locked",
        isOpening:
          local?.status === "open" ||
          hunt?.status === "open" ||
          Boolean(hunt?.isOpening),
        createdAt: local?.created_at || hunt?.createdAt || hunt?.created_at || null,
        updatedAt: local?.updated_at || hunt?.updatedAt || hunt?.updated_at || null,
      };
    });

    return NextResponse.json({
      success: true,
      hunts,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      hunts: [],
      note: error?.message || "Failed to load hunts",
    });
  }
}