import { siteDb, requireTrackerAdmin, apiError } from "@/lib/site-db";
import { catalogue } from "@/lib/roulo-catalogue";
import { money } from "@/lib/tracker-math";
export async function POST(request: Request) {
  try {
    const actor = await requireTrackerAdmin(request),
      b = await request.json(),
      db = siteDb();
    let result;
    if (b.action === "reorder") {
      result = await db.rpc("site_tracker_reorder", {
        p_actor: actor,
        p_hunt: b.huntId,
        p_entries: b.entryIds,
      });
    } else if (b.action === "select") {
      result = await db.rpc("site_tracker_select", {
        p_actor: actor,
        p_hunt: b.huntId || null,
      });
    } else if (b.action === "removeEntry") {
      result = await db.rpc("site_tracker_remove_entry", {
        p_actor: actor,
        p_entry: b.entryId,
      });
    } else if (b.action === "manual") {
      money(b.bet);
      const game = (await catalogue()).find(
        (g) => g.identifier === b.identifier && g.enabled !== false,
      );
      if (!game) throw new Error("Select an enabled catalogue game");
      result = await db.rpc("site_tracker_manual", {
        p_actor: actor,
        p_hunt: b.huntId,
        p_request: b.requestId,
        p_game: {
          ...game,
          bonus_tier: b.tier || "standard",
          notes: b.notes || "",
        },
        p_bet: b.bet,
      });
    } else if (b.action === "delete") {
      result = await db.rpc("site_tracker_delete", {
        p_actor: actor,
        p_hunt: b.huntId,
        p_title: b.confirmTitle,
      });
    } else if (b.action === "edit") {
      money(b.start);
      if (
        typeof b.title !== "string" ||
        !b.title.trim() ||
        b.title.length > 160
      )
        throw new Error("Enter a hunt title");
      result = await db.rpc("site_tracker_edit", {
        p_actor: actor,
        p_hunt: b.huntId,
        p_title: b.title.trim(),
        p_start: b.start,
      });
    } else if (b.action === "create") {
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
      result = await db.rpc("site_tracker_bonus_edit", {
        p_actor: actor,
        p_entry: b.entryId,
        p_payout: b.payout,
        p_bet: b.bet,
        p_cost: b.cost,
        p_tier: b.tier ?? null,
        p_notes: b.notes ?? null,
      });
    } else if (b.action === "resolve") {
      const games = await catalogue(),
        game = games.find(
          (g) => g.identifier === b.identifier && g.enabled !== false,
        );
      if (!game) throw new Error("Select an enabled game");
      const { data: setting, error: settingError } = await db
        .from("site_tracker_settings")
        .select("active_hunt_id")
        .eq("id", true)
        .maybeSingle();
      if (settingError) throw new Error(settingError.message);
      if (setting?.active_hunt_id) {
        const { data: duplicate, error } = await db
          .from("site_tracker_entries")
          .select("id")
          .eq("hunt_id", setting.active_hunt_id)
          .eq("identifier", game.identifier)
          .eq("status", "collected")
          .is("deleted_at", null)
          .limit(1);
        if (error) throw new Error(error.message);
        if (duplicate?.length) {
          await db.rpc("site_tracker_resolve", {
            p_actor: actor,
            p_call: String(b.callId),
            p_identifier: game.identifier,
            p_name: game.name,
          });
          return Response.json({ ok: true, ignored: true });
        }
      }
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
