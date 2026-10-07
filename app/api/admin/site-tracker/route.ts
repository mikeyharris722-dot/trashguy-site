import { siteDb, requireTrackerAdmin, apiError } from "@/lib/site-db";
import { catalogue } from "@/lib/roulo-catalogue";
import { money } from "@/lib/tracker-math";
export async function POST(request: Request) {
  try {
    const actor = await requireTrackerAdmin(request),
      b = await request.json(),
      db = siteDb();
    let result;
    if (b.action === "create") {
      money(b.start);
      if (
        typeof b.title !== "string" ||
        !b.title.trim() ||
        b.title.length > 160
      )
        throw new Error("Enter a hunt title");
      result = await db.rpc("site_tracker_create", {
        p_actor: actor,
        p_title: b.title.trim(),
        p_start: b.start,
      });
    } else if (b.action === "undo")
      result = await db.rpc("site_tracker_undo", {
        p_actor: actor,
        p_entry: b.entryId,
      });
    else if (b.action === "phase")
      result = await db.rpc("site_tracker_phase", {
        p_actor: actor,
        p_hunt: b.huntId,
        p_phase: b.phase,
      });
    else if (b.action === "collect") {
      money(b.bet);
      money(b.cost);
      if (b.payout !== undefined && b.payout !== null) {
        money(b.payout);
        if (b.status !== "collected")
          throw new Error("Only collected bonuses can have a payout");
        result = await db.rpc("site_tracker_record", {
          p_actor: actor,
          p_hunt: b.huntId,
          p_call: b.callId,
          p_bet: b.bet,
          p_cost: b.cost,
          p_payout: b.payout,
        });
      } else
        result = await db.rpc("site_tracker_collect", {
          p_actor: actor,
          p_hunt: b.huntId,
          p_call: b.callId,
          p_status: b.status,
          p_bet: b.bet,
          p_cost: b.cost,
        });
    } else if (b.action === "payout") {
      if (b.payout !== null) money(b.payout);
      money(b.bet);
      money(b.cost);
      result = await db.rpc("site_tracker_payout", {
        p_actor: actor,
        p_entry: b.entryId,
        p_payout: b.payout,
        p_bet: b.bet,
        p_cost: b.cost,
      });
    } else if (b.action === "resolve") {
      const games = await catalogue(),
        game = games.find(
          (g) => g.identifier === b.identifier && g.enabled !== false,
        );
      if (!game) throw new Error("Select an enabled game");
      result = await db.rpc("site_tracker_resolve", {
        p_actor: actor,
        p_call: String(b.callId),
        p_identifier: game.identifier,
        p_name: game.name,
      });
    } else throw new Error("Unknown action");
    if (result.error) throw new Error(result.error.message);
    return Response.json({ ok: true, result: result.data });
  } catch (e) {
    return apiError(e);
  }
}
