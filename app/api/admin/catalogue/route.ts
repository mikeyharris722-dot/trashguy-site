import { catalogue, fetchRouloCatalogue } from "@/lib/roulo-catalogue";
import { siteDb, requireTrackerAdmin, apiError } from "@/lib/site-db";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const actor = await requireTrackerAdmin(request),
      body = await request.json(),
      db = siteDb();
    if (body.action === "update") {
      const result = await fetchRouloCatalogue();
      const { error } = await db.from("roulo_catalogue_state").upsert({
        id: true,
        games: result.games,
        updated_at: new Date().toISOString(),
        source: "https://roulobets.com/game-maps/byKey.json",
      });
      if (error) throw new Error(error.message);
      return Response.json({
        ok: true,
        total: result.games.length,
        added: result.added,
        missing: result.missing,
        artworkWarning: result.artworkWarning,
      });
    }
    if (body.action === "override") {
      const games = await catalogue();
      if (!games.some((g) => g.identifier === body.identifier))
        throw new Error("Unknown game");
      if (body.artwork_url) {
        const url = new URL(body.artwork_url);
        if (url.protocol !== "https:")
          throw new Error("Artwork must use HTTPS");
      }
      const patch = {
        identifier: body.identifier,
        name:
          typeof body.name === "string"
            ? body.name.trim().slice(0, 160)
            : undefined,
        artwork_url: body.artwork_url || undefined,
        aliases: Array.isArray(body.aliases)
          ? body.aliases
              .filter((x: unknown) => typeof x === "string")
              .slice(0, 30)
          : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        updated_at: new Date().toISOString(),
      };
      const { error } = await db
        .from("roulo_catalogue_overrides")
        .upsert(patch);
      if (error) throw new Error(error.message);
      await db.from("site_tracker_audit").insert({
        actor,
        action: "catalogue_override",
        details: { identifier: body.identifier },
      });
      return Response.json({ ok: true });
    }
    throw new Error("Unknown action");
  } catch (e) {
    return apiError(e);
  }
}
