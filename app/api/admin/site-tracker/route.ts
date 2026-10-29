import {scheduleSlotBoard} from "@/lib/discord-slot-board";
import {huntCurrency} from '@/lib/hunt-currency';
import {payoutFx} from '@/lib/hunt-fx';
import { siteDb, requireTrackerAdmin, apiError } from "@/lib/site-db";
import { catalogue } from "@/lib/roulo-catalogue";
import { trackerHunts } from "@/lib/site-tracker";
import { saveReviewNativeSelection } from "@/lib/review-selection";
import { money } from "@/lib/tracker-math";
export async function POST(request: Request) {
  try {
    const actor = await requireTrackerAdmin(request),
      b = await request.json(),
      db = siteDb();
    if (process.env.NEXT_PUBLIC_LOCAL_REVIEW === "1") {
      if (b.action !== "select")
        throw Error(
          "Local review: existing hunt records are read-only. Use a local community hunt to test saving bonuses.",
        );
      const id = String(b.huntId || "");
      if (id && !(await trackerHunts()).some((h) => h.id === id))
        throw Error("Choose an existing hunt.");
      await saveReviewNativeSelection(id);
      return Response.json({ ok: true, result: id });
    }
    async function fxFor(huntId?:string,entryId?:string){let id=huntId;let entry:{hunt_id:string;payout:string|null;payout_usd:string|null}|null=null;if(entryId){const r=await db.from('site_tracker_entries').select('hunt_id,payout,payout_usd').eq('id',entryId).single();if(r.error)throw Error('Bonus not found.');entry=r.data;id=entry!.hunt_id;}const r=await db.from('site_tracker_hunts').select('currency').eq('hunt_id',id).single();if(r.error)throw Error('Hunt currency could not be loaded.');if(entry&&entry.payout_usd!==null&&Number(entry.payout)===Number(b.payout))return null;return b.payout===null?null:await payoutFx(r.data.currency);}
    let result;
    if (b.action === "openingFocus") {
      result = await db.rpc("site_tracker_opening_focus", {
        p_actor: actor,
        p_hunt: b.huntId,
        p_entries: b.entryIds,
      });
    } else if (b.action === "reorder") {
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
          caller_profile_id: b.callerProfileId || null,
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
      result = await db.rpc("site_tracker_create_currency", {
        p_actor: actor,
        p_title: b.title.trim(),
        p_start: b.start,
        p_currency:huntCurrency(b.currency),
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
      const tier = b.tier ?? "standard";
      if (!["standard", "super", "super_super"].includes(tier))
        throw new Error("Choose Normal, Super or Super Super.");
      const hasPayout = b.payout !== undefined && b.payout !== null;
      if (hasPayout) {
        money(b.payout);
        if (b.status !== "collected")
          throw new Error("Only collected bonuses can have a payout");
      }
      result = await db.rpc("site_tracker_collect_tier", {
        p_actor: actor,
        p_hunt: b.huntId,
        p_call: b.callId,
        p_status: b.status,
        p_bet: b.bet,
        p_cost: b.cost,
        p_tier: tier,
        p_payout: hasPayout ? b.payout : null,
        p_fx: hasPayout ? await fxFor(b.huntId) : null,
      });
    } else if (b.action === "payout") {
      if (b.payout !== null) money(b.payout);
      money(b.bet);
      money(b.cost);
      result = await db.rpc("site_tracker_bonus_edit_currency", {
        p_actor: actor,
        p_entry: b.entryId,
        p_payout: b.payout,
        p_bet: b.bet,
        p_cost: b.cost,
        p_tier: b.tier ?? null,
        p_notes: b.notes ?? null,
        p_fx:await fxFor(undefined,b.entryId),
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
          .select("id,identifier,slot_name")
          .eq("hunt_id", setting.active_hunt_id)
          .eq("status", "collected")
          .is("deleted_at", null);
        if (error) throw new Error(error.message);
        if (
          duplicate?.some(
            (e) =>
              e.identifier === game.identifier ||
              e.slot_name.trim().toLowerCase() ===
                game.name.trim().toLowerCase(),
          )
        ) {
          const resolved = await db.rpc("site_tracker_resolve", {
            p_actor: actor,
            p_call: String(b.callId),
            p_identifier: game.identifier,
            p_name: game.name,
          });
          if (resolved.error) throw new Error(resolved.error.message);
          scheduleSlotBoard();
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
    scheduleSlotBoard();
    return Response.json({ ok: true, result: result.data });
  } catch (e) {
    return apiError(e);
  }
}
