import "server-only";
import {
  readDocument,
  commitDocument,
  requestKey,
  receipt,
} from "./community-store";
import initialCatalogue from "@/data/rainbet-community.json";
import { validLaunch } from "./community-local";
export function normalizeImport(input: unknown) {
  const raw = Array.isArray(input)
    ? input
    : (input as { games?: unknown[] })?.games;
  if (!Array.isArray(raw) || !raw.length || raw.length > 15000)
    throw Error(
      "Import an array of Rainbet games or an object containing games.",
    );
  return raw.map((value) => {
    const g = value as Record<string, unknown>;
    if (
      !g ||
      typeof g !== "object" ||
      typeof g.name !== "string" ||
      !g.name.trim() ||
      g.name.length > 160
    )
      throw Error("Invalid catalogue game name.");
    const identifier =
      g.identifier || (Number.isSafeInteger(g.id) ? "rainbet-" + g.id : null);
    const provider = g.provider || g.producer;
    if (
      typeof identifier !== "string" ||
      !identifier ||
      typeof provider !== "string" ||
      !provider
    )
      throw Error("Every game needs a source identifier and provider.");
    if (g.type !== undefined && g.type !== "slots")
      throw Error("Only slot records can be imported.");
    let launch = g.rainbet_launch_url || g.url || null;
    if (
      typeof launch === "string" &&
      /^[a-z0-9][a-z0-9-]{0,249}$/.test(launch) &&
      g.type === "slots"
    )
      launch = "https://rainbet.com/casino/slots/" + launch;
    if (launch !== null && !validLaunch(launch))
      throw Error("Invalid Rainbet game URL. No records were saved.");
    const image = g.artwork_url || g.custom_banner || g.icon || null;
    if (image !== null) {
      let u;
      try {
        u = new URL(String(image));
      } catch {
        throw Error("Invalid artwork URL");
      }
      if (u.protocol !== "https:" || u.username || u.password)
        throw Error("Artwork must use HTTPS.");
    }
    return {
      identifier,
      name: g.name.trim(),
      provider,
      artwork_url: image === null ? null : String(image),
      rainbet_launch_url: launch === null ? null : String(launch),
    };
  });
}
export async function saveCatalogue(
  raw: unknown,
  actor = "local-test",
  requestId?: string,
) {
  const imported = normalizeImport(raw);
  const key = requestKey({ records: imported, requestId }, actor, "catalogue");
  for (let attempt = 0; attempt < 12; attempt++) {
    const replay = await receipt("catalogue", actor, key);
    if (replay)
      return replay.result as {
        total: number;
        added: number;
        imported: number;
      };
    const snapshot = await readDocument<ReturnType<typeof normalizeImport>>(
      "catalogue",
      initialCatalogue,
    );
    const existing = snapshot.payload.length
      ? snapshot.payload
      : initialCatalogue;
    const byId = new Map(existing.map((g) => [g.identifier, g])),
      byUrl = new Map(
        existing
          .filter((g) => g.rainbet_launch_url)
          .map((g) => [g.rainbet_launch_url, g]),
      );
    let added = 0;
    const seen = new Set<string>();
    for (const g of imported) {
      if (seen.has(g.identifier))
        throw Error("Duplicate source identifiers in import.");
      seen.add(g.identifier);
      const old =
        byId.get(g.identifier) ||
        (g.rainbet_launch_url ? byUrl.get(g.rainbet_launch_url) : undefined);
      if (old) byId.set(old.identifier, { ...g, identifier: old.identifier });
      else {
        byId.set(g.identifier, g);
        added++;
      }
    }
    const records = [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const result = { total: records.length, added, imported: imported.length };
    const saved = await commitDocument(
      "catalogue",
      records,
      snapshot.version,
      result,
      actor,
      key,
    );
    if (saved.committed) return saved.result as typeof result;
  }
  throw Error("Another catalogue update is running. Please retry.");
}

export async function fetchCatalogue(country: string) {
  if (!["GB", "IE", "CA", "AU", "NZ"].includes(country))
    throw Error("Choose a supported catalogue country.");
  const deadline = Date.now() + 45000;
  const games: unknown[] = [],
    seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 250; page++) {
    if (Date.now() > deadline)
      throw Error(
        "Rainbet took too long. Catalogue unchanged; use JSON import.",
      );
    const url = new URL("https://services.rainbet.com/v1/public/games/list");
    url.searchParams.set("grouping", "slots");
    url.searchParams.set("sort_by", "recommended");
    url.searchParams.set("country", country);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json")
    )
      throw Error(
        "Rainbet blocked or failed the request. Catalogue unchanged. Use JSON import below.",
      );
    const body = await response.text();
    if (body.length > 2000000) throw Error("Rainbet page exceeds size limit.");
    const d = JSON.parse(body);
    if (
      !Array.isArray(d.games) ||
      !(d.next_cursor === null || typeof d.next_cursor === "string")
    )
      throw Error("Unexpected Rainbet response. Catalogue unchanged.");
    games.push(...d.games);
    if (games.length > 15000) throw Error("Catalogue size limit exceeded.");
    if (d.next_cursor === null) return games;
    if (seen.has(d.next_cursor))
      throw Error("Repeated Rainbet page. Catalogue unchanged.");
    seen.add(d.next_cursor);
    cursor = d.next_cursor;
  }
  throw Error("Incomplete catalogue. No records saved.");
}
