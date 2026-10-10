import { communityState, communityTracker } from "@/lib/community-local";
import { apiError } from "@/lib/site-db";
export async function GET() {
  try {
    const s = await communityState(),
      h = s.hunts.find((h) => h.id === s.activeHuntId && !h.deleted);
    if (!h) return Response.json({ hunt: null });
    const dto = communityTracker(h);
    const rows = h.entries
      .filter((e) => !e.deleted_at && e.status === "collected")
      .sort((a, b) => {
        const ai = h.openingQueue.indexOf(a.id),
          bi = h.openingQueue.indexOf(b.id);
        return (
          (ai < 0 ? 1e9 : ai) - (bi < 0 ? 1e9 : bi) ||
          a.sort_order - b.sort_order
        );
      });
    const summary = (e: (typeof rows)[number]) => ({
      id: e.id,
      slotName: e.slot_name,
      username: e.username,
      betSize: Number(e.bet_size),
      payout: e.payout === null ? null : Number(e.payout),
      multiplier: e.payout === null ? 0 : Number(e.payout) / Number(e.bet_size),
      tier: e.bonus_tier,
    });
    const latest = [...rows]
      .filter((e) => e.payout !== null)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    return Response.json(
      {
        hunt: {
          id: h.id,
          title: h.title,
          phase: h.phase,
          startCost: dto.startCost,
          stats: dto.stats,
          bonuses: rows.map(summary),
          latest: latest ? summary(latest) : null,
          currentId: rows.find((e) => e.payout === null)?.id || null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
