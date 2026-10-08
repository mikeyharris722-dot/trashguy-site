import { NextRequest, NextResponse } from "next/server";
import { requireTrackerAdmin } from "@/lib/site-db";
import { requiresAdmin } from "@/lib/api-access";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (process.env.NEXT_PUBLIC_LOCAL_REVIEW === "1") {
    const localCommunity =
      process.env.COMMUNITY_HUNT_LOCAL === "1" &&
      process.env.NODE_ENV !== "production";
    const localWrite =
      path === "/api/kick/logout" ||
      (localCommunity &&
        [
          "/api/community",
          "/api/community/tracker",
          "/api/community/catalogue",
          "/api/admin/site-tracker",
        ].includes(path));
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !localWrite)
      return NextResponse.json(
        {
          error:
            "Local review: this action changes live data, so it is disabled here. Community Hunt tests are saved locally.",
        },
        { status: 403 },
      );
  }
  if (request.method !== "OPTIONS" && requiresAdmin(path, request.method)) {
    try {
      await requireTrackerAdmin(request);
    } catch {
      return NextResponse.json(
        { error: "AUTH: Sign in as an admin to use this action." },
        { status: 403 },
      );
    }
  }
  const response = NextResponse.next();
  if (requiresAdmin(path, request.method) || path === "/api/prize-portal")
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: "/api/:path*" };
