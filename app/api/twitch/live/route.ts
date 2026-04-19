import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_STREAMS_URL = "https://api.twitch.tv/helix/streams";

export async function GET() {
  const clientId = process.env.TWITCH_CLIENT_ID || process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const channelLogin = process.env.TWITCH_CHANNEL_LOGIN || "trashguy__";

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      success: true,
      isLive: false,
      title: "",
      gameName: "",
      viewerCount: 0,
      startedAt: "",
      note: "Missing Twitch server credentials."
    });
  }

  try {
    const tokenResponse = await fetch(TWITCH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials"
      }),
      cache: "no-store"
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();

      return NextResponse.json({
        success: true,
        isLive: false,
        title: "",
        gameName: "",
        viewerCount: 0,
        startedAt: "",
        note: `Twitch token request failed: ${text}`
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData?.access_token;

    if (!accessToken) {
      return NextResponse.json({
        success: true,
        isLive: false,
        title: "",
        gameName: "",
        viewerCount: 0,
        startedAt: "",
        note: "No Twitch access token returned."
      });
    }

    const streamResponse = await fetch(
      `${TWITCH_STREAMS_URL}?user_login=${encodeURIComponent(channelLogin)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": clientId
        },
        cache: "no-store"
      }
    );

    if (!streamResponse.ok) {
      const text = await streamResponse.text();

      return NextResponse.json({
        success: true,
        isLive: false,
        title: "",
        gameName: "",
        viewerCount: 0,
        startedAt: "",
        note: `Twitch stream request failed: ${text}`
      });
    }

    const streamData = await streamResponse.json();
    const stream = Array.isArray(streamData?.data) ? streamData.data[0] : null;

    if (!stream) {
      return NextResponse.json({
        success: true,
        isLive: false,
        title: "",
        gameName: "",
        viewerCount: 0,
        startedAt: ""
      });
    }

    return NextResponse.json({
      success: true,
      isLive: true,
      title: stream.title || "",
      gameName: stream.game_name || "",
      viewerCount: Number(stream.viewer_count || 0),
      startedAt: stream.started_at || ""
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      isLive: false,
      title: "",
      gameName: "",
      viewerCount: 0,
      startedAt: "",
      note: error?.message || "Unknown Twitch error"
    });
  }
}