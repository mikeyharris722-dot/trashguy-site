import { NextResponse } from "next/server";
import { syncRouloLinks } from "@/lib/roulo-sync";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await syncRouloLinks();

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Roulo sync failed.",
      },
      { status: 500 }
    );
  }
}