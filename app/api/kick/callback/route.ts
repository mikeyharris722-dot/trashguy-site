import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createKickSessionToken, KICK_SESSION_COOKIE } from "@/lib/kick-session";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function normalizeUsername(value: unknown) {
  return String(value || "").replace(/^@/, "").trim().toLowerCase();
}

async function findOrCreateKickProfile(kickId: string, username: string) {
  const syntheticEmail = `kick_${kickId}@kick.trashguy.local`;

  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  let authUserId = users.users.find((user) => user.email === syntheticEmail)?.id || "";

  if (!authUserId) {
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: {
        provider: "kick",
        kick_user_id: kickId,
        preferred_username: username,
        user_name: username,
        name: username,
      },
    });

    if (createError || !created.user?.id) {
      throw createError || new Error("Unable to create the Kick site account.");
    }
    authUserId = created.user.id;
  }

  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();
  if (profileError) throw profileError;

  if (!existingProfile?.id) {
    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: authUserId, username });
    if (insertError) throw insertError;
  } else {
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ username })
      .eq("id", authUserId);
    if (updateError) throw updateError;
  }

  return authUserId;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const returnedState = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("kick_state")?.value;
  const codeVerifier = req.cookies.get("kick_code_verifier")?.value;

  if (!code || !returnedState || !expectedState || returnedState !== expectedState || !codeVerifier) {
    return NextResponse.redirect(new URL("/?kick_error=invalid_oauth_state", req.url));
  }

  try {
    const tokenRes = await fetch("https://id.kick.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.KICK_CLIENT_ID || "",
        client_secret: process.env.KICK_CLIENT_SECRET || "",
        redirect_uri: process.env.KICK_REDIRECT_URI || "",
        code,
        code_verifier: codeVerifier,
      }),
      cache: "no-store",
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData?.access_token) {
      console.error("Kick token error:", tokenData);
      return NextResponse.redirect(new URL("/?kick_error=token_failed", req.url));
    }

    const userRes = await fetch("https://api.kick.com/public/v1/users", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: "no-store",
    });
    const userData = await userRes.json();
    if (!userRes.ok) {
      console.error("Kick user error:", userData);
      return NextResponse.redirect(new URL("/?kick_error=user_failed", req.url));
    }

    const user = Array.isArray(userData?.data) ? userData.data[0] : userData?.data;
    const username = normalizeUsername(user?.name || user?.username);
    const kickId = String(user?.user_id || user?.id || "").trim();
    const displayName = String(user?.name || user?.username || username).trim();
    const avatarUrl = String(user?.profile_picture || user?.profile_pic || user?.avatar || "").trim();

    if (!username || !kickId) {
      return NextResponse.redirect(new URL("/?kick_error=missing_user", req.url));
    }

    const profileId = await findOrCreateKickProfile(kickId, username);
    const sessionToken = createKickSessionToken({ profileId, kickId, username, displayName, avatarUrl });

    const response = NextResponse.redirect(new URL("/?platform=kick", req.url));
    response.cookies.set(KICK_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set("kick_code_verifier", "", { path: "/", maxAge: 0 });
    response.cookies.set("kick_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Kick callback failed:", error);
    return NextResponse.redirect(new URL("/?kick_error=callback_failed", req.url));
  }
}
