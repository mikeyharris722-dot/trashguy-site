import { refreshArtworkIndex, findArtwork } from "./roulo-artwork";
import "server-only";
import { siteDb } from "./site-db";
import type { CatalogueGame } from "./slot-matching";
import seed from "@/data/roulo-catalogue.json";
export async function catalogue(): Promise<CatalogueGame[]> {
  const db = siteDb();
  const { data, error } = await db
    .from("roulo_catalogue_state")
    .select("games")
    .eq("id", true)
    .maybeSingle();
  if (error && error.code !== "PGRST205" && error.code !== "42P01")
    throw new Error(error.message);
  const base: CatalogueGame[] = data?.games || seed;
  const overrides = await db.from("roulo_catalogue_overrides").select("*");
  if (
    overrides.error &&
    overrides.error.code !== "PGRST205" &&
    overrides.error.code !== "42P01"
  )
    throw new Error(overrides.error.message);
  const byId = new Map((overrides.data || []).map((o) => [o.identifier, o]));
  return base.map((g) => {
    const o = byId.get(g.identifier);
    return o
      ? {
          ...g,
          ...Object.fromEntries(
            Object.entries(o).filter(
              ([k, v]) => v !== null && k !== "updated_at",
            ),
          ),
        }
      : g;
  });
}
export async function fetchRouloCatalogue() {
  const res = await fetch("https://roulobets.com/game-maps/byKey.json", {
    cache: "no-store",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok)
    throw new Error(
      `Catalogue source returned ${res.status}; existing catalogue retained.`,
    );
  const text = await res.text();
  if (text.length > 15000000) throw new Error("Catalogue source too large");
  const body = JSON.parse(text);
  if (!body.entries || typeof body.entries !== "object")
    throw new Error("Unexpected catalogue format");
  let artwork = new Map<string, string>(),
    artworkWarning = "";
  try {
    artwork = await refreshArtworkIndex();
  } catch (e) {
    artworkWarning = e instanceof Error ? e.message : "Artwork refresh failed";
  }
  const current = await catalogue(),
    known = new Map(current.map((g) => [g.identifier, g])),
    games = new Map<string, CatalogueGame>();
  for (const value of Object.values(body.entries)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    if (
      typeof v.identifier !== "string" ||
      typeof v.title !== "string" ||
      typeof v.provider !== "string"
    )
      continue;
    const candidate = {
      identifier: v.identifier,
      identifier2: v.identifier2,
      provider: v.provider,
      producer: typeof v.producer === "string" ? v.producer : "",
    };
    const image =
      findArtwork(artwork, candidate) ||
      known.get(v.identifier)?.artwork_url ||
      null;
    if (!known.has(v.identifier) && !image) continue; // Do not promote unverified live/other metadata into the slot picker.
    games.set(v.identifier, {
      identifier: v.identifier,
      name: v.title,
      provider: v.provider,
      producer: candidate.producer,
      artwork_url: image,
    });
  }
  if (games.size < 1000 || games.size > 30000)
    throw new Error("Suspicious catalogue size; existing catalogue retained.");
  const added = [...games.keys()].filter((k) => !known.has(k)).length;
  const missing = current.filter((g) => !games.has(g.identifier)).length;
  // Preserve missing records: removal is a separate manual decision, never a sync side effect.
  for (const g of current)
    if (!games.has(g.identifier)) games.set(g.identifier, g);
  return { games: [...games.values()], added, missing, artworkWarning };
}
