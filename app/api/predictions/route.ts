import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAuth = createClient(supabaseUrl, publishableKey);

async function getSignedInUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { user: null, error: "Missing auth token." };
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: "Invalid Twitch session." };
  }

  return { user: data.user, error: null };
}

function getTwitchUsername(user: any) {
  const identityData =
    user?.identities?.[0]?.identity_data as Record<string, unknown> | undefined;

  return (
    (user?.user_metadata?.preferred_username as string | undefined) ||
    (user?.user_metadata?.user_name as string | undefined) ||
    (identityData?.preferred_username as string | undefined) ||
    (identityData?.user_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    (identityData?.name as string | undefined) ||
    "viewer"
  );
}

function getTwitchUserId(user: any) {
  const identity = Array.isArray(user?.identities)
    ? user.identities.find((item: any) => item?.provider === "twitch") || user.identities[0]
    : undefined;

  const identityData =
    identity?.identity_data as Record<string, unknown> | undefined;

  return (
    (identityData?.provider_id as string | undefined) ||
    (identity?.id as string | undefined) ||
    (user?.user_metadata?.provider_id as string | undefined) ||
    (user?.user_metadata?.sub as string | undefined) ||
    (user?.id as string | undefined) ||
    ""
  );
}

async function ensureProfileExists(
  userId: string,
  username: string,
  twitchUserId: string
) {
  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfileError) {
    return { ok: false, error: existingProfileError.message };
  }

  if (existingProfile?.id) {
    return { ok: true, error: null };
  }

  const insertPayload = {
    id: userId,
    username,
    twitch_user_id: twitchUserId,
  };

  const { error: insertError } = await supabaseAdmin
    .from("profiles")
    .insert(insertPayload);

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true, error: null };
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("predictions")
      .select("id, profile_id, guess_amount, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({
        success: true,
        predictions: [],
        note: error.message,
      });
    }

    const profileIds = Array.from(
      new Set((data || []).map((row) => row.profile_id).filter(Boolean))
    );

    let usernameMap: Record<string, string> = {};

    if (profileIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .in("id", profileIds);

      usernameMap = Object.fromEntries(
        (profiles || []).map((profile: any) => [
          profile.id,
          profile.username || profile.id,
        ])
      );
    }

    const predictions = (data || []).map((row) => ({
      id: row.id,
      username: usernameMap[row.profile_id] || row.profile_id,
      guess: Number(row.guess_amount || 0),
      created_at: row.updated_at || row.created_at,
    }));

    return NextResponse.json({
      success: true,
      predictions,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      predictions: [],
      note: error?.message || "Failed to load predictions",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getSignedInUser(req);

    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const guessAmount = Number(body?.guessAmount || 0);

    if (!guessAmount || Number.isNaN(guessAmount)) {
      return NextResponse.json(
        { error: "Missing or invalid guessAmount" },
        { status: 400 }
      );
    }

    const userId = auth.user.id;
    const username = getTwitchUsername(auth.user);
    const twitchUserId = getTwitchUserId(auth.user);

    if (!twitchUserId) {
      return NextResponse.json(
        { error: "Missing Twitch user id." },
        { status: 500 }
      );
    }

    const profileCheck = await ensureProfileExists(userId, username, twitchUserId);

    if (!profileCheck.ok) {
      return NextResponse.json(
        { error: profileCheck.error || "Failed to create profile." },
        { status: 500 }
      );
    }

    const { data: activeHunt, error: huntError } = await supabaseAdmin
      .from("hunts")
      .select("id, status")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (huntError) {
      return NextResponse.json({ error: huntError.message }, { status: 500 });
    }

    if (!activeHunt?.id) {
      return NextResponse.json(
        { error: "No open hunt found." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("predictions")
      .select("id")
      .eq("hunt_id", activeHunt.id)
      .eq("profile_id", userId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("predictions")
        .update({
          guess_amount: guessAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        prediction: data,
        username,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("predictions")
      .insert({
        hunt_id: activeHunt.id,
        profile_id: userId,
        guess_amount: guessAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      prediction: data,
      username,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}