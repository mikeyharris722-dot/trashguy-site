import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAuth = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type ResolvedHunt = {
  id: string;
  external_hunt_id: string | null;
  status: string | null;
  prediction_status: string | null;
};

function normalizeUsername(value: unknown) {
  return String(value || "").replace(/^@/, "").trim().toLowerCase();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

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
  const identity = Array.isArray(user?.identities)
    ? user.identities.find((item: any) => item?.provider === "twitch") ||
      user.identities[0]
    : undefined;

  const identityData = identity?.identity_data as
    | Record<string, unknown>
    | undefined;

  return normalizeUsername(
    user?.user_metadata?.preferred_username ||
      user?.user_metadata?.user_name ||
      identityData?.preferred_username ||
      identityData?.user_name ||
      user?.user_metadata?.name ||
      identityData?.name ||
      "viewer"
  );
}

function getTwitchUserId(user: any) {
  const identity = Array.isArray(user?.identities)
    ? user.identities.find((item: any) => item?.provider === "twitch") ||
      user.identities[0]
    : undefined;

  const identityData = identity?.identity_data as
    | Record<string, unknown>
    | undefined;

  return String(
    identityData?.provider_id ||
      identity?.id ||
      user?.user_metadata?.provider_id ||
      user?.user_metadata?.sub ||
      user?.id ||
      ""
  ).trim();
}

async function resolveProfile(
  userId: string,
  username: string,
  twitchUserId: string
) {
  const byId = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (byId.error) {
    return { profileId: null, error: byId.error.message };
  }

  if (byId.data?.id) {
    return { profileId: byId.data.id as string, error: null };
  }

  if (twitchUserId) {
    const byTwitchId = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("twitch_user_id", twitchUserId)
      .maybeSingle();

    if (byTwitchId.error) {
      return { profileId: null, error: byTwitchId.error.message };
    }

    if (byTwitchId.data?.id) {
      return { profileId: byTwitchId.data.id as string, error: null };
    }
  }

  if (username) {
    const byUsername = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (byUsername.error) {
      return { profileId: null, error: byUsername.error.message };
    }

    if (byUsername.data?.id) {
      return { profileId: byUsername.data.id as string, error: null };
    }
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: userId,
      username,
      twitch_user_id: twitchUserId,
    })
    .select("id")
    .single();

  if (!insertError && inserted?.id) {
    return { profileId: inserted.id as string, error: null };
  }

  // A concurrent request may have created the profile first.
  const retry = await supabaseAdmin
    .from("profiles")
    .select("id")
    .or(
      [
        username ? `username.eq.${username}` : "",
        twitchUserId ? `twitch_user_id.eq.${twitchUserId}` : "",
      ]
        .filter(Boolean)
        .join(",")
    )
    .limit(1)
    .maybeSingle();

  if (!retry.error && retry.data?.id) {
    return { profileId: retry.data.id as string, error: null };
  }

  return {
    profileId: null,
    error: insertError?.message || retry.error?.message || "Failed to resolve profile.",
  };
}

async function resolveHunt(requestedHuntId: string) {
  const huntId = String(requestedHuntId || "").trim();

  if (!huntId) {
    return { hunt: null as ResolvedHunt | null, error: "Missing hunt id." };
  }

  const fields = "id, external_hunt_id, status, prediction_status";

  const byExternalId = await supabaseAdmin
    .from("hunts")
    .select(fields)
    .eq("external_hunt_id", huntId)
    .maybeSingle();

  if (byExternalId.error) {
    return { hunt: null, error: byExternalId.error.message };
  }

  if (byExternalId.data?.id) {
    return { hunt: byExternalId.data as ResolvedHunt, error: null };
  }

  if (!isUuid(huntId)) {
    return { hunt: null, error: "Hunt not found." };
  }

  const byId = await supabaseAdmin
    .from("hunts")
    .select(fields)
    .eq("id", huntId)
    .maybeSingle();

  if (byId.error) {
    return { hunt: null, error: byId.error.message };
  }

  if (!byId.data?.id) {
    return { hunt: null, error: "Hunt not found." };
  }

  return { hunt: byId.data as ResolvedHunt, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const requestedHuntId = request.nextUrl.searchParams.get("huntId") || "";

    if (!requestedHuntId) {
      return NextResponse.json({ success: true, predictions: [] });
    }

    const resolved = await resolveHunt(requestedHuntId);

    if (!resolved.hunt?.id) {
      return NextResponse.json({
        success: true,
        predictions: [],
        note: resolved.error || "Hunt not found.",
      });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("predictions")
      .select("id, profile_id, guess_amount, created_at, updated_at")
      .eq("hunt_id", resolved.hunt.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, predictions: [], error: error.message },
        { status: 500 }
      );
    }

    // Older data may contain more than one row for the same viewer.
    // Keep only the newest row per profile without changing the database.
    const newestByProfile = new Map<string, any>();

    for (const row of rows || []) {
      const key = String(row.profile_id || row.id);
      if (!newestByProfile.has(key)) newestByProfile.set(key, row);
    }

    const uniqueRows = Array.from(newestByProfile.values());
    const profileIds = uniqueRows
      .map((row) => row.profile_id)
      .filter(Boolean) as string[];

    let usernameMap: Record<string, string> = {};

    if (profileIds.length > 0) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .in("id", profileIds);

      if (profileError) {
        return NextResponse.json(
          { success: false, predictions: [], error: profileError.message },
          { status: 500 }
        );
      }

      usernameMap = Object.fromEntries(
        (profiles || []).map((profile: any) => [
          profile.id,
          profile.username || profile.id,
        ])
      );
    }

    const predictions = uniqueRows.map((row) => ({
      id: String(row.id),
      profile_id: String(row.profile_id || ""),
      username: usernameMap[row.profile_id] || row.profile_id || "viewer",
      guess: Number(row.guess_amount || 0),
      guess_amount: Number(row.guess_amount || 0),
      created_at: row.updated_at || row.created_at || null,
      updated_at: row.updated_at || row.created_at || null,
    }));

    return NextResponse.json({
      success: true,
      huntId: resolved.hunt.id,
      predictionStatus: resolved.hunt.prediction_status || "locked",
      predictions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        predictions: [],
        error: error instanceof Error ? error.message : "Failed to load predictions.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getSignedInUser(request);

    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const guessAmount = Number(body?.guessAmount);
    const requestedHuntId = String(body?.huntId || "").trim();

    if (!Number.isFinite(guessAmount) || guessAmount <= 0) {
      return NextResponse.json(
        { error: "Enter a valid prediction greater than zero." },
        { status: 400 }
      );
    }

    if (!requestedHuntId) {
      return NextResponse.json({ error: "Missing hunt id." }, { status: 400 });
    }

    const resolved = await resolveHunt(requestedHuntId);

    if (!resolved.hunt?.id) {
      return NextResponse.json(
        { error: resolved.error || "Hunt not found." },
        { status: 404 }
      );
    }

    if (resolved.hunt.prediction_status !== "open") {
      return NextResponse.json(
        { error: "Predictions are locked." },
        { status: 409 }
      );
    }

    const username = getTwitchUsername(auth.user);
    const twitchUserId = getTwitchUserId(auth.user);

    if (!twitchUserId) {
      return NextResponse.json(
        { error: "Missing Twitch user id." },
        { status: 400 }
      );
    }

    const profile = await resolveProfile(auth.user.id, username, twitchUserId);

    if (!profile.profileId) {
      return NextResponse.json(
        { error: profile.error || "Failed to resolve profile." },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("predictions")
      .select("id")
      .eq("hunt_id", resolved.hunt.id)
      .eq("profile_id", profile.profileId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const existingId = existingRows?.[0]?.id;

    if (existingId) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("predictions")
        .update({ guess_amount: guessAmount, updated_at: now })
        .eq("id", existingId)
        .select("id, profile_id, guess_amount, created_at, updated_at")
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        username,
        prediction: {
          ...updated,
          username,
          guess: Number(updated.guess_amount || 0),
        },
      });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("predictions")
      .insert({
        hunt_id: resolved.hunt.id,
        profile_id: profile.profileId,
        guess_amount: guessAmount,
        created_at: now,
        updated_at: now,
      })
      .select("id, profile_id, guess_amount, created_at, updated_at")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      username,
      prediction: {
        ...inserted,
        username,
        guess: Number(inserted.guess_amount || 0),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 }
    );
  }
}
