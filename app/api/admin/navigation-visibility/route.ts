import { requireTrackerAdmin, apiError } from "@/lib/site-db";
import { communityJson } from "@/lib/community-request";
import { communityCommand } from "@/lib/community-local";
import { serverPrizeSettings } from "@/lib/server-prize-settings";
export async function POST(request: Request) {
  try {
    const id = await requireTrackerAdmin(request),
      body = await communityJson(request, 2048);
    if (
      !["tournaments", "community"].includes(String(body.section)) ||
      typeof body.enabled !== "boolean"
    )
      throw Error("Choose valid public menu visibility.");
    await communityCommand({ id, name: "Admin" }, true, {
      action: "navigationVisibility",
      section: body.section,
      enabled: body.enabled,
      requestId: body.requestId,
    });
    return Response.json(
      { settings: await serverPrizeSettings() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
