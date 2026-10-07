import { catalogue } from "@/lib/roulo-catalogue";
import { matchSlot, normaliseSlot } from "@/lib/slot-matching";
import { apiError } from "@/lib/site-db";
export async function GET(request: Request) {
  try {
    const games = await catalogue(),
      q = new URL(request.url).searchParams.get("q") || "";
    const matched = q ? matchSlot(q, games) : null;
    const ranked = q
      ? [
          ...new Map(
            [
              ...(matched?.suggestions || []),
              ...games.filter(
                (g) =>
                  g.enabled !== false &&
                  normaliseSlot(`${g.name} ${g.provider}`).includes(
                    normaliseSlot(q),
                  ),
              ),
            ].map((g) => [g.identifier, g]),
          ).values(),
        ].slice(0, 20)
      : [];
    return Response.json({
      games:
        new URL(request.url).searchParams.get("all") === "true"
          ? games
          : ranked,
      match: matched,
      total: games.length,
    });
  } catch (e) {
    return apiError(e);
  }
}
