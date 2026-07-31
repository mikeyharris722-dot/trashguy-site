import { NextRequest, NextResponse } from "next/server";
import { KICK_SESSION_COOKIE, verifyKickSessionToken } from "@/lib/kick-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = verifyKickSessionToken(request.cookies.get(KICK_SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    platform: "kick",
    profileId: session.profileId,
    kickId: session.kickId,
    username: session.username,
    displayName: session.displayName,
    avatarUrl: session.avatarUrl,
  });
}
