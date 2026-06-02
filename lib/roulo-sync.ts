import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: string) {
  return String(value || "").replace("@", "").trim().toLowerCase();
}

function getDateRange() {
  const end = new Date();

  return {
    start_at: "2024-01-01",
    end_at: end.toISOString().slice(0, 10),
  };
}

function getRoleAndWeight({
  isOnCode,
  isVipSnapshot,
  isInDiscord,
}: {
  isOnCode: boolean;
  isVipSnapshot: boolean;
  isInDiscord: boolean;
}) {
  const weight =
    1 +
    (isInDiscord ? 0.1 : 0) +
    (isOnCode ? 0.1 : 0) +
    (isVipSnapshot ? 0.1 : 0);

  const role = isVipSnapshot ? "vip" : isOnCode ? "affiliate" : "viewer";

  return {
    role,
    weight: Number(weight.toFixed(2)),
  };
}

function getPlayerName(player: any) {
  return normalize(
    player?.username ||
      player?.name ||
      player?.display_name ||
      player?.user_name ||
      player?.player_name ||
      player?.affiliate_username ||
      player?.user?.username ||
      player?.user?.name ||
      ""
  );
}

function getPlayerWagered(player: any) {
  return Number(
    player?.wagered_amount ??
      player?.amount_wagered ??
      player?.wagered ??
      player?.total_wagered ??
      player?.totalWagered ??
      player?.wageredAmount ??
      player?.wager ??
      player?.amount ??
      player?.stats?.wagered ??
      player?.stats?.total_wagered ??
      0
  );
}

function getAffiliatesFromResponse(json: any) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.affiliates)) return json.affiliates;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.results)) return json.results;
  if (Array.isArray(json?.players)) return json.players;
  if (Array.isArray(json?.users)) return json.users;
  if (Array.isArray(json?.data?.affiliates)) return json.data.affiliates;
  if (Array.isArray(json?.data?.results)) return json.data.results;

  return [];
}

export async function syncRouloLinks() {
  const key = process.env.ROULO_API_KEY;

  if (!key) {
    throw new Error("Missing ROULO_API_KEY");
  }

  const { data: links, error: linksError } = await supabase
    .from("roulo_links")
    .select("*");

  if (linksError) {
    throw new Error(linksError.message);
  }

  if (!links || links.length === 0) {
    return { ok: true, updated: 0, matched: 0, totalLinks: 0 };
  }

  const { start_at, end_at } = getDateRange();

  const res = await fetch(
    `https://api.roulobets.com/v1/external/affiliates?start_at=${start_at}&end_at=${end_at}&key=${key}`,
    { cache: "no-store" }
  );

  const json = await res.json();
  const affiliates = getAffiliatesFromResponse(json);

  console.log("Roulo sync response:", {
    affiliateCount: affiliates.length,
    firstAffiliate: affiliates[0] || null,
  });

  let updated = 0;
  let matched = 0;

  for (const link of links) {
    const rouloUsername = normalize(link.roulo_username || "");

    if (!rouloUsername) continue;

    const match = affiliates.find((player: any) => {
      const apiRouloName = getPlayerName(player);
      return apiRouloName === rouloUsername;
    });

    if (!match) {
      console.log("No Roulo match for:", rouloUsername);
      continue;
    }

    matched++;

const wagered = getPlayerWagered(match);

const { data: vipSnapshot } = await supabase
  .from("vip_snapshots")
  .select("id")
  .eq("roulo_username", rouloUsername)
  .limit(1)
  .maybeSingle();

const isOnCode = !!rouloUsername;
const isInDiscord = !!link.is_in_discord;
const isVipSnapshot = !!vipSnapshot;

const { role, weight } = getRoleAndWeight({
  isOnCode,
  isVipSnapshot,
  isInDiscord,
});

    console.log("Roulo matched:", {
      twitch: link.twitch_username,
      rouloUsername,
      wagered,
      role,
      apiPlayer: match,
    });

    const { error: updateError } = await supabase
      .from("roulo_links")
      .update({
        wagered,
        role,
        weight,
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    if (updateError) {
      console.error("Roulo link update failed:", updateError.message);
      continue;
    }

    updated++;
  }

  return {
    ok: true,
    updated,
    matched,
    totalLinks: links.length,
    affiliateCount: affiliates.length,
  };
}