import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

function getRoleAndWeight(wagered: number) {
  const amount = Number(wagered || 0);

  if (amount >= 5000) {
    return { role: "vip", weight: 1.2 };
  }

  if (amount >= 100) {
    return { role: "affiliate", weight: 1.1 };
  }

  return { role: "viewer", weight: 1 };
}

function getAffiliateUsername(player: any) {
  return normalize(
    player.username ||
      player.name ||
      player.display_name ||
      player.user_name ||
      player.roulo_username ||
      ""
  );
}

function getAffiliateWagered(player: any) {
  return Number(
    player.wagered_amount ||
      player.wagered ||
      player.amount_wagered ||
      player.total_wagered ||
      0
  );
}

export async function syncRouloLinks() {
  const apiKey = process.env.ROULO_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "Missing ROULO_API_KEY" };
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 31);

  const url = new URL("https://api.roulobets.com/v1/external/affiliates");
  url.searchParams.set("start_at", start.toISOString());
  url.searchParams.set("end_at", end.toISOString());
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json();

  const affiliates = Array.isArray(data?.affiliates)
    ? data.affiliates
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];

  const { data: links, error: linksError } = await supabase
    .from("roulo_links")
    .select("*");

  if (linksError) {
    return { ok: false, error: linksError.message };
  }

  const affiliateMap = new Map();

  affiliates.forEach((affiliate: any) => {
    const username = getAffiliateUsername(affiliate);
    if (!username) return;

    affiliateMap.set(username, {
      username,
      wagered: getAffiliateWagered(affiliate),
    });
  });

  for (const link of links || []) {
    const rouloUsername = normalize(link.roulo_username);
    const matched = affiliateMap.get(rouloUsername);

    const wagered = Number(matched?.wagered || 0);
    const { role, weight } = getRoleAndWeight(wagered);

    await supabase
      .from("roulo_links")
      .update({
        wagered,
        role,
        weight,
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);
  }

  return {
    ok: true,
    updated: links?.length || 0,
  };
}