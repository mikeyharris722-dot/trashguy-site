import { communityState, communityCommand } from "@/lib/community-local";
import { resolvedPrizeSettings } from "@/lib/prize-settings";
import { requireTrackerAdmin, apiError } from "@/lib/site-db";
import { communityJson } from "@/lib/community-request";
export async function GET() {
  try {
    return Response.json(
      {
        settings: resolvedPrizeSettings((await communityState()).prizeSettings),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const id = await requireTrackerAdmin(request);
    const body = await communityJson(request);
    await communityCommand({ id, name: "Admin" }, true, {
      action: "prizeSettings",
      settings: body.settings,
      requestId: body.requestId,
    });
    return GET();
  } catch (error) {
    return apiError(error);
  }
}
