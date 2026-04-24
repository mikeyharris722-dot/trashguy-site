import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const key = url.searchParams.get("key");
    const user = url.searchParams.get("user");
    const amountRaw = url.searchParams.get("amount");
    const note = url.searchParams.get("note") || "";

    // Nightbot save mode
    if (key || user || amountRaw) {
      if (key !== process.env.GIVEAWAY_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const winnerName = String(user || "").replace("@", "").trim();
      const amount = Number(amountRaw || 0);

      if (!winnerName) {
        return NextResponse.json({ error: "Missing winner name" }, { status: 400 });
      }

      if (!amount || Number.isNaN(amount)) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }

      const { error } = await supabase
        .from("giveaways")
        .insert({
          winner_name: winnerName,
          amount,
          note: note || null,
          source: "nightbot",
        });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return new NextResponse(`${winnerName} won $${amount}`, { status: 200 });
    }

    // Website load mode
    const { data, error } = await supabase
      .from("giveaways")
      .select("id, winner_name, amount, note, source, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        giveaways: [],
        total: 0,
        note: error.message,
      });
    }

    const giveaways = data || [];
    const total = giveaways.reduce(
      (sum: number, item: any) => sum + Number(item.amount || 0),
      0
    );

    return NextResponse.json({
      success: true,
      giveaways,
      total,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      giveaways: [],
      total: 0,
      note: error?.message || "Failed to load giveaways",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const key = url.searchParams.get("key") || "";
    const user = url.searchParams.get("user") || "";
    const amountRaw = url.searchParams.get("amount") || "";
    const note = url.searchParams.get("note") || "";

    if (key !== process.env.GIVEAWAY_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const winnerName = user.replace("@", "").trim();
    const amount = Number(amountRaw);

    if (!winnerName) {
      return NextResponse.json({ error: "Missing winner name" }, { status: 400 });
    }

    if (!amount || Number.isNaN(amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("giveaways")
      .insert({
        winner_name: winnerName,
        amount,
        note: note || null,
        source: "nightbot",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${winnerName} won $${amount}`,
      giveaway: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save giveaway" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const id = url.searchParams.get("id");

    if (key !== process.env.GIVEAWAY_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("giveaways")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Delete failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const id = url.searchParams.get("id");

    if (key !== process.env.GIVEAWAY_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json();
    const { winner_name, amount, note } = body;

    const { error } = await supabase
      .from("giveaways")
      .update({
        winner_name,
        amount,
        note,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Update failed" },
      { status: 500 }
    );
  }
}