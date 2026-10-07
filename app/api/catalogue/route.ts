import { catalogue } from "@/lib/roulo-catalogue";
import { matchSlot, normaliseSlot } from "@/lib/slot-matching";
import { apiError } from "@/lib/site-db";
export async function GET(request: Request) {
  try {
    const games = await catalogue(),
      q = new URL(request.url).searchParams.get("q") || "";
    return Response.json({
      games:
        new URL(request.url).searchParams.get("all") === "true"
          ? games
          : q
            ? games
                .filter((g) =>
                  normaliseSlot(`${g.name} ${g.provider}`).includes(
                    normaliseSlot(q),
                  ),
                )
                .slice(0, 30)
            : [],
      match: q ? matchSlot(q, games) : null,
      total: games.length,
    });
  } catch (e) {
    return apiError(e);
  }
}
