import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?kick_error=missing_code", req.url));
  }

  const tokenRes = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
body: new URLSearchParams({
  grant_type: "authorization_code",
  client_id: process.env.KICK_CLIENT_ID || "",
  client_secret: process.env.KICK_CLIENT_SECRET || "",
  redirect_uri: process.env.KICK_REDIRECT_URI || "",
  code,
  code_verifier: req.cookies.get("kick_code_verifier")?.value || "",
}),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    console.error("Kick token error:", tokenData);
    return NextResponse.redirect(new URL("/?kick_error=token_failed", req.url));
  }

  const userRes = await fetch("https://api.kick.com/public/v1/users", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const userData = await userRes.json();

  if (!userRes.ok) {
    console.error("Kick user error:", userData);
    return NextResponse.redirect(new URL("/?kick_error=user_failed", req.url));
  }

  const user = Array.isArray(userData?.data) ? userData.data[0] : userData?.data;

  const username = user?.name || user?.username || "";
  const kickId = user?.user_id || user?.id || "";

const redirectUrl = new URL("/", req.url);
redirectUrl.searchParams.set("kick_username", username || "kick_user");
redirectUrl.searchParams.set("kick_id", String(kickId || ""));
redirectUrl.searchParams.set("platform", "kick");

return NextResponse.redirect(redirectUrl);
}