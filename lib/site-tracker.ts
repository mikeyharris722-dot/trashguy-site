import "server-only";
import { siteDb } from "./site-db";
import { trackerStats } from "./tracker-math";
export async function trackerHunts() {
  const db = siteDb();
  const { data: settings, error } = await db
    .from("site_tracker_hunts")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw new Error(error.message);
  }
  const { data: entries, error: entryError } = await db
    .from("site_tracker_entries")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order")
    .order("created_at");
  if (entryError) throw new Error(entryError.message);
  return (settings || []).map((h) => {
    const rows = (entries || []).filter((e) => e.hunt_id === h.hunt_id),
      stats = trackerStats(h.start_amount, rows);
    return {
      id: h.hunt_id,
      local_id: h.hunt_id,
      external_hunt_id: null,
      source: "site",
      title: h.title,
      casino: "Roulobets",
      startCost: Number(h.start_amount),
      status: h.phase === "finished" ? "completed" : "open",
      prediction_status: h.phase === "collecting" ? "open" : "locked",
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
