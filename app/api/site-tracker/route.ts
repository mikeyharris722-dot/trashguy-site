import { apiError, siteDb } from "@/lib/site-db";
import { trackerHunts } from "@/lib/site-tracker";
export async function GET() {
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
    return Response.json({
      hunts: hunts.map((h) => ({
        ...h,
        openingQueue:
          h.id === settings.data?.active_hunt_id
            ? settings.data?.opening_queue || []
            : [],
      })),
      activeHuntId: settings.data?.active_hunt_id || "",
    });
  } catch (e) {
    return apiError(e);
  }
}
