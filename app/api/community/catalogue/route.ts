import { requireTrackerAdmin, apiError } from "@/lib/site-db";
import { communityState } from "@/lib/community-local";
import { fetchCatalogue, saveCatalogue } from "@/lib/community-catalogue";
export async function POST(request: Request) {
  try {
    await communityState();
    await requireTrackerAdmin(request);
    if (Number(request.headers.get("content-length") || 0) > 10000000)
      throw Error("Import file too large.");
    const b = await request.json();
    const records =
      b.action === "update"
        ? await fetchCatalogue(b.country || "GB")
        : b.action === "import"
          ? b.records
          : null;
    if (records === null) throw Error("Unknown catalogue action");
    const result = await saveCatalogue(records);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return apiError(e);
  }
}
