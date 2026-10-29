import "server-only";
import { siteDb } from "./site-db";
import { trackerStats } from "./tracker-math";
export async function trackerHunts(huntId?: string) {
  const db = siteDb();
  let settingsQuery = db.from("site_tracker_hunts").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (huntId) settingsQuery = settingsQuery.eq("hunt_id", huntId);
  const { data: settings, error } = await settingsQuery;
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw new Error(error.message);
  }
  const ids = (settings || []).map(h => h.hunt_id);
  if (!ids.length) return [];
  const [entryRead, predictionRead] = await Promise.all([
    db.from("site_tracker_entries").select("*").in("hunt_id", ids).is("deleted_at", null).order("sort_order").order("created_at"),
    db.from("hunts").select("id,prediction_status").in("id", ids),
  ]);
  if (entryRead.error) throw new Error(entryRead.error.message);
  if (predictionRead.error) throw new Error(predictionRead.error.message);
  const entries = entryRead.data || [];
  const predictionStates = new Map<string, string>((predictionRead.data || []).map(h => [h.id, h.prediction_status === "open" ? "open" : "locked"]));
  return (settings || []).map((h) => {
    const rows = (entries || []).filter((e) => e.hunt_id === h.hunt_id),
      stats = trackerStats(h.start_amount, rows);
    return {
      id: h.hunt_id,
      local_id: h.hunt_id,
      external_hunt_id: null,
      source: "site",
      title: h.title,
      currency:h.currency||"USD",
      casino: "Roulobets",
      startCost: Number(h.start_amount),
      status: h.phase === "finished" ? "completed" : "open",
      prediction_status: predictionStates.get(h.hunt_id) ?? "locked",
      isOpening: h.phase === "opening",
      createdAt: h.created_at,
      updatedAt: h.updated_at,
      stats,
      phase: h.phase,
      entries: rows,
      bonuses: rows
        .filter((e) => e.status === "collected")
        .map((e, index) => ({
          id: e.id,
          slotName: e.slot_name,
          bonusTier: e.bonus_tier || "standard",
          provider: e.provider || "",
          slotImage: e.artwork_url || "",
          betSize: Number(e.bet_size),
          payout: e.payout === null ? null : Number(e.payout),
          multiplier:
            e.payout === null ? 0 : Number(e.payout) / Number(e.bet_size),
          note: e.username,
          order: index,
          createdAt: e.created_at,
        })),
    };
  });
}
