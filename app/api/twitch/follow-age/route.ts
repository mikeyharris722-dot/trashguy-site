import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_USERS_URL = "https://api.twitch.tv/helix/users";
const TWITCH_FOLLOWERS_URL = "https://api.twitch.tv/helix/channels/followers";

function formatFollowAge(followedAt: string) {
  const start = new Date(followedAt).getTime();
  const diff = Math.max(0, Date.now() - start);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const leftoverDays = days % 30;

  if (years > 0) return `${years} year${years === 1 ? "" : "s"}`;
  if (months > 0) return `${months} month${months === 1 ? "" : "s"}`;
  if (leftoverDays > 0) return `${leftoverDays} day${leftoverDays === 1 ? "" : "s"}`;

  return "today";
}

async function getAppToken(clientId: string, clientSecret: string) {
  const tokenResponse = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });

  const tokenData = await tokenResponse.json();

  return {
    accessToken: tokenData?.access_token || "",
    error: tokenResponse.ok ? "" : JSON.stringify(tokenData),
  };
}

async function getUserId(login: string, clientId: string, appToken: string) {
  const res = await fetch(
    `${TWITCH_USERS_URL}?login=${encodeURIComponent(login.trim().toLowerCase())}`,
    {
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Client-Id": clientId,
      },
      cache: "no-store",
    }
  );

  const data = await res.json();

  return {
    id: data?.data?.[0]?.id || "",
    error: res.ok ? "" : JSON.stringify(data),
  };
}

export async function GET(req: NextRequest) {
  const clientId =
    process.env.TWITCH_CLIENT_ID || process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const moderatorToken = process.env.TWITCH_MODERATOR_TOKEN;
  const channelLogin = process.env.TWITCH_CHANNEL_LOGIN || "trashguy__";

  const winnerLogin = req.nextUrl.searchParams.get("user") || "";

  if (!clientId || !clientSecret || !moderatorToken) {
    return NextResponse.json({
      ok: false,
      following: false,
      followAge: "",
      error: "Missing Twitch env vars.",
      debug: {
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(clientSecret),
        hasModeratorToken: Boolean(moderatorToken),
      },
    });
  }

  if (!winnerLogin) {
    return NextResponse.json({
      ok: false,
      following: false,
      followAge: "",
      error: "Missing user.",
    });
  }

  try {
    const appTokenResult = await getAppToken(clientId, clientSecret);
    const appToken = appTokenResult.accessToken;

    if (!appToken) {
      return NextResponse.json({
        ok: false,
        following: false,
        followAge: "",
        error: "No Twitch app token returned.",
        twitchError: appTokenResult.error,
        debug: {
          hasClientId: Boolean(clientId),
          hasClientSecret: Boolean(clientSecret),
        },
      });
    }

    const broadcasterResult = await getUserId(channelLogin, clientId, appToken);
    const winnerResult = await getUserId(winnerLogin, clientId, appToken);

    const broadcasterId = broadcasterResult.id;
    const winnerId = winnerResult.id;

    if (!broadcasterId || !winnerId) {
      return NextResponse.json({
        ok: true,
        following: false,
        followAge: "Unknown",
        debug: {
          channelLogin,
          winnerLogin,
          broadcasterId,
          winnerId,
          broadcasterError: broadcasterResult.error,
          winnerError: winnerResult.error,
        },
      });
    }

    const followRes = await fetch(
      `${TWITCH_FOLLOWERS_URL}?broadcaster_id=${broadcasterId}&user_id=${winnerId}`,
      {
        headers: {
          Authorization: `Bearer ${moderatorToken}`,
          "Client-Id": clientId,
        },
        cache: "no-store",
      }
    );

    const followData = await followRes.json();

    if (!followRes.ok) {
      return NextResponse.json({
        ok: false,
        following: false,
        followAge: "",
        error: followData?.message || "Twitch follow request failed.",
        twitchError: followData,
      });
    }

    const follow = Array.isArray(followData?.data) ? followData.data[0] : null;

    if (!follow?.followed_at) {
      return NextResponse.json({
        ok: true,
        following: false,
        followAge: "Not following",
      });
    }

    return NextResponse.json({
      ok: true,
      following: true,
      followedAt: follow.followed_at,
      followAge: formatFollowAge(follow.followed_at),
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      following: false,
      followAge: "",
      error: error?.message || "Unknown Twitch error.",
    });
  }
}