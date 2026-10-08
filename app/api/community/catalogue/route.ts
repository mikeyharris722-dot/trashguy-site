import { communityJson } from "@/lib/community-request";
import { requireTrackerAdmin, apiError } from "@/lib/site-db";
import { communityState } from "@/lib/community-local";
import { fetchCatalogue, saveCatalogue } from "@/lib/community-catalogue";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    await communityState();
    const actor = await requireTrackerAdmin(request);
    const b = await communityJson(request, 4000000);
    const records =
      b.action === "update"
        ? await fetchCatalogue(String(b.country || "GB"))
        : b.action === "import"
          ? b.records
          : null;
    if (records === null) throw Error("Unknown catalogue action");
    const result = await saveCatalogue(
      records,
      actor,
      typeof b.requestId === "string" ? b.requestId : undefined,
    );
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return apiError(e);
  }
}
