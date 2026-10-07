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
    const h = hunts.find((h) => h.id === settings.data?.active_hunt_id);
    if (!h) return Response.json({ hunt: null });
    const queue: string[] = settings.data?.opening_queue || [];
    const rows = h.entries.filter((e) => e.status === "collected");
    const summary = (e: (typeof rows)[number]) => ({
      id: e.id,
      slotName: e.slot_name,
      betSize: Number(e.bet_size),
      payout: e.payout === null ? null : Number(e.payout),
      multiplier: e.payout === null ? 0 : Number(e.payout) / Number(e.bet_size),
      tier: e.bonus_tier,
    });
    const latest = rows
      .filter((e) => e.payout !== null)
      .sort((a, b) =>
        String(b.updated_at).localeCompare(String(a.updated_at)),
      )[0];
    const sorted = [...rows].sort((a, b) => {
      const ai = queue.indexOf(a.id),
        bi = queue.indexOf(b.id);
      return (
        (ai < 0 ? 1e9 : ai) - (bi < 0 ? 1e9 : bi) || a.sort_order - b.sort_order
      );
    });
    return Response.json(
      {
        hunt: {
          id: h.id,
          title: h.title,
          phase: h.phase,
          startCost: h.startCost,
          stats: h.stats,
          bonuses: sorted.map(summary),
          latest: latest ? summary(latest) : null,
          currentId: sorted.find((e) => e.payout === null)?.id || null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
