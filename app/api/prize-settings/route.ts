import {serverPrizeSettings} from '@/lib/server-prize-settings';
import {ensureWeeklySetup} from "@/lib/weekly-wager-server";
import { communityState, communityCommand } from "@/lib/community-local";
import {ensureBossRewardSetup} from "@/lib/trash-boss-claims";
import {validatePrizeSettings,type PrizeSettings} from "@/lib/prize-settings";
import { requireTrackerAdmin, apiError } from "@/lib/site-db";
import { communityJson } from "@/lib/community-request";
export async function GET() {
  try {
    return Response.json(
      {
        settings: await serverPrizeSettings(),
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
    const previous=(await communityState()).prizeSettings;
    const submitted=body.settings&&typeof body.settings==="object"?body.settings as Partial<PrizeSettings>:{};
    const requested=validatePrizeSettings({...submitted,weeklyWager:submitted.weeklyWager??previous?.weeklyWager});
    if(requested.weeklyWager?.enabled)await ensureWeeklySetup();
    if(requested.trashBossesEnabled)await ensureBossRewardSetup();
    await communityCommand({ id, name: "Admin" }, true, {
      action: "prizeSettings",
      settings: requested,
      requestId: body.requestId,
    });
    return GET();
  } catch (error) {
    return apiError(error);
  }
}
