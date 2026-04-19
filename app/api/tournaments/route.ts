import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_USERS = ["trashguy__", "trashguy", "parz"];

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
        { id: "m4", player1: "Player G", player2: "Player H", winner: "" }
      ]
    },
    {
      id: "round-2",
      name: "Semifinals",
      matches: [
        { id: "m5", player1: "Winner QF1", player2: "Winner QF2", winner: "" },
        { id: "m6", player1: "Winner QF3", player2: "Winner QF4", winner: "" }
      ]
    },
    {
      id: "round-3",
      name: "Final",
      matches: [
        { id: "m7", player1: "Winner SF1", player2: "Winner SF2", winner: "" }
      ]
    }
  ]
};

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "tournament-bracket.json");

async function ensureFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(defaultBracket, null, 2), "utf8");
  }
}

async function readBracket() {
  await ensureFile();

  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed?.title || !Array.isArray(parsed?.rounds)) {
      throw new Error("Invalid bracket file structure.");
    }

    return parsed;
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(defaultBracket, null, 2), "utf8");
    return defaultBracket;
  }
}

async function writeBracket(bracket: unknown) {
  await ensureFile();
  await fs.writeFile(dataFile, JSON.stringify(bracket, null, 2), "utf8");
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

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { ok: false, error: "Missing auth token." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, error: "Supabase environment variables are missing." };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.getUser(token);

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

export async function GET() {
  try {
    const bracket = await readBracket();
    return NextResponse.json({ success: true, bracket });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      bracket: defaultBracket,
      error: error?.message || "Failed to load bracket."
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request);

    if (!adminCheck.ok) {
      return NextResponse.json(
        { success: false, error: adminCheck.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const bracket = body?.bracket;

    if (!isValidBracket(bracket)) {
      return NextResponse.json(
        { success: false, error: "Invalid bracket payload." },
        { status: 400 }
      );
    }

    await writeBracket(bracket);

    return NextResponse.json({
      success: true,
      bracket
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to save bracket."
      },
      { status: 500 }
    );
  }
}