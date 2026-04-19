import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_USERS = ["trashguy__", "trashguy", "parz", "parzwz"];

const defaultBracket = {
  title: "Trashguy Tournament",
  rounds: [
    {
      id: "round-1",
      name: "Quarterfinals",
      matches: [
        { id: "m1", player1: "Player A", player2: "Player B", winner: "" },
        { id: "m2", player1: "Player C", player2: "Player D", winner: "" },
        { id: "m3", player1: "Player E", player2: "Player F", winner: "" },
        { id: "m4", player1: "Player G", player2: "Player H", winner: "" },
      ],
    },
    {
      id: "round-2",
      name: "Semifinals",
      matches: [
        { id: "m5", player1: "Winner QF1", player2: "Winner QF2", winner: "" },
        { id: "m6", player1: "Winner QF3", player2: "Winner QF4", winner: "" },
      ],
    },
    {
      id: "round-3",
      name: "Final",
      matches: [
        { id: "m7", player1: "Winner SF1", player2: "Winner SF2", winner: "" },
      ],
    },
  ],
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAuth = createClient(supabaseUrl, publishableKey);

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { ok: false, error: "Missing auth token." };
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data?.user) {
    return { ok: false, error: "Invalid Twitch session." };
  }

  const user = data.user;
  const identityData =
    user.identities?.[0]?.identity_data as Record<string, unknown> | undefined;

  const login =
    (user.user_metadata?.preferred_username as string | undefined) ||
    (user.user_metadata?.user_name as string | undefined) ||
    (identityData?.preferred_username as string | undefined) ||
    (identityData?.user_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (identityData?.name as string | undefined) ||
    "";

  if (!ADMIN_USERS.includes(login.toLowerCase())) {
    return { ok: false, error: "Not authorized." };
  }

  return { ok: true, login };
}

function isValidBracket(bracket: any) {
  return (
    bracket &&
    typeof bracket.title === "string" &&
    Array.isArray(bracket.rounds) &&
    bracket.rounds.every(
      (round: any) =>
        round &&
        typeof round.id === "string" &&
        typeof round.name === "string" &&
        Array.isArray(round.matches) &&
        round.matches.every(
          (match: any) =>
            match &&
            typeof match.id === "string" &&
            typeof match.player1 === "string" &&
            typeof match.player2 === "string" &&
            typeof match.winner === "string"
        )
    )
  );
}

async function getLatestTournament() {
  const { data, error } = await supabaseAdmin
    .from("tournaments")
    .select("id, title, bracket, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { tournament: null, error: error.message };
  }

  return { tournament: data, error: null };
}

export async function GET() {
  try {
    const latest = await getLatestTournament();

    if (latest.error) {
      return NextResponse.json({
        success: true,
        bracket: defaultBracket,
        note: latest.error,
      });
    }

    if (!latest.tournament) {
      return NextResponse.json({
        success: true,
        bracket: defaultBracket,
      });
    }

    const bracket =
      latest.tournament.bracket &&
      typeof latest.tournament.bracket === "object"
        ? latest.tournament.bracket
        : defaultBracket;

    return NextResponse.json({
      success: true,
      bracket: {
        ...bracket,
        title:
          typeof bracket.title === "string" && bracket.title.trim()
            ? bracket.title
            : latest.tournament.title || defaultBracket.title,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      bracket: defaultBracket,
      note: error?.message || "Failed to load tournament.",
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request);

    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: 401 });
    }

    const body = await request.json();
    const bracket = body?.bracket;

    if (!isValidBracket(bracket)) {
      return NextResponse.json(
        { error: "Invalid bracket payload." },
        { status: 400 }
      );
    }

    const latest = await getLatestTournament();

    if (latest.error) {
      return NextResponse.json({ error: latest.error }, { status: 500 });
    }

    if (!latest.tournament?.id) {
      const { data, error } = await supabaseAdmin
        .from("tournaments")
        .insert({
          title: bracket.title,
          bracket,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id, title, bracket")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        bracket: data.bracket,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("tournaments")
      .update({
        title: bracket.title,
        bracket,
        updated_at: new Date().toISOString(),
      })
      .eq("id", latest.tournament.id)
      .select("id, title, bracket")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bracket: data.bracket,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save bracket." },
      { status: 500 }
    );
  }
}