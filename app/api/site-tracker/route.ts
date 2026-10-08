import {
  communityEnabled,
  communityState,
  communityTracker,
} from "@/lib/community-local";
import { requireTrackerAdmin } from "@/lib/site-db";
import { apiError, siteDb } from "@/lib/site-db";
import { trackerHunts } from "@/lib/site-tracker";
import { reviewNativeSelection } from "@/lib/review-selection";
export async function GET(request: Request) {
  try {
    const [hunts, settings] = await Promise.all([
      trackerHunts(),
      siteDb()
        .from("site_tracker_settings")
        .select("active_hunt_id,opening_queue")
        .eq("id", true)
        .maybeSingle(),
    ]);
    if (settings.error) throw new Error(settings.error.message);
    const local = communityEnabled() ? await communityState() : null;
    let admin = false;
    try {
      await requireTrackerAdmin(request);
      admin = true;
    } catch {}
    const communityHunts = (local?.hunts || [])
      .filter((h) => !h.deleted)
      .map((h) => {
        const dto = communityTracker(h);
        return {
          ...dto,
          entries: admin
            ? dto.entries
            : dto.entries.map((e) => ({ ...e, notes: "" })),
        };
      });
    return Response.json({
      hunts: [
        ...communityHunts,
        ...hunts.map((h) => ({
          ...h,
          openingQueue:
            h.id === settings.data?.active_hunt_id
              ? settings.data?.opening_queue || []
              : [],
        })),
      ],
      activeHuntId:
        local?.activeHuntId ||
        (await reviewNativeSelection()) ||
        settings.data?.active_hunt_id ||
        "",
    });
  } catch (e) {
    return apiError(e);
  }
}
