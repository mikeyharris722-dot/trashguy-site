import { communityEnabled, communityState } from "@/lib/community-local";
import { reviewNativeSelection } from "@/lib/review-selection";
import { catalogue } from "@/lib/roulo-catalogue";
import { matchSlot } from "@/lib/slot-matching";
import { apiError, requireTrackerAdmin } from "@/lib/site-db";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/review-client";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

/*
  ============================================================
  GET
  LOAD CURRENT SLOT CALLS + SAVED/ROLLED RESULTS
  ============================================================
*/

export async function GET() {
  try {
  if (communityEnabled()) {
    const state = await communityState();
    const hunt = state.hunts.find(
      (h) => h.id === state.activeHuntId && !h.deleted,
    );
    if (hunt) {
      const entries = hunt.entries.filter((e) => !e.deleted_at);
      const collected = new Set(
        entries
          .filter((e) => e.status === "collected")
          .map((e) => e.identifier),
      );
      return NextResponse.json(
        {
          calls: hunt.calls
            .filter(
              (c) =>
                (c.status === "queued" || c.status === "selected") &&
                !collected.has(c.identifier),
            )
            .map((c) => ({
              id: c.id,
              username: c.username,
              slot_name: c.slot_name,
              created_at: hunt.createdAt,
            })),
          reviewCalls: [],
          results: entries.map((e) => ({
            id: e.id,
            username: e.username,
            slot_name: e.slot_name,
            payout: e.payout,
            status: e.status,
            created_at: e.created_at,
          })),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const [callsRead, settingsRead] = await Promise.all([
    supabase.from("slot_calls").select("*").order("created_at", { ascending: true }),
    supabase.from("site_tracker_settings").select("active_hunt_id").eq("id", true).maybeSingle(),
  ]);
  if (callsRead.error) throw new Error(callsRead.error.message);
  if (settingsRead.error) throw new Error(settingsRead.error.message);
  const calls = callsRead.data || [];
  const activeId = (await reviewNativeSelection()) || settingsRead.data?.active_hunt_id;
  const [metadataRead, resultsRead] = await Promise.all([
    calls.length ? supabase.from("roulo_call_matches").select("*").in("call_id", calls.map(c => String(c.id))) : Promise.resolve({data: [], error: null}),
    activeId
      ? supabase.from("site_tracker_entries").select("id,identifier,username,slot_name,payout,status,created_at").eq("hunt_id", activeId).is("deleted_at", null).order("created_at", {ascending:false})
      : supabase.from("slot_call_results").select("*").order("created_at", {ascending:false}),
  ]);
  if (metadataRead.error) throw new Error(metadataRead.error.message);
  if (resultsRead.error) throw new Error(resultsRead.error.message);
  const metadata = new Map((metadataRead.data || []).map(m => [String(m.call_id), m]));
  const results = resultsRead.data || [];
  const collected = activeId ? results.filter(e => e.status === "collected") : [];
  const identifiers = new Set(collected.map(e => e.identifier));
  const names = new Set(collected.map(e => e.slot_name.trim().toLowerCase()));
  return NextResponse.json({
    calls: calls.map(c => {
      const m = metadata.get(String(c.id));
      return {...c, needs_review:m?.status === "review", original_request:m?.original_request || c.slot_name, suggestions:m?.suggestions || []};
    }).filter(c => !activeId || (!identifiers.has(metadata.get(String(c.id))?.identifier) && (c.needs_review || !names.has(c.slot_name.trim().toLowerCase())))),
    reviewCalls: calls.flatMap(c => { const m = metadata.get(String(c.id)); return m?.status === "review" ? [{...c,...m}] : []; }),
    results,
  }, {headers:{"Cache-Control":"no-store"}});
  } catch (error) { return apiError(error); }
}

/*
  ============================================================
  POST
  CREATE SLOT CALLS
  SAVE BONUS-HUNT RESULTS
  SAVE IMMEDIATE RESULTS
  EDIT EXISTING RESULTS
  ============================================================
*/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const action = String(body.action || "").trim();
    if (action) await requireTrackerAdmin(req);

    /*
      ========================================================
      SAVE RESULT

      Used for BOTH:

      1. SAVE FOR BONUS HUNT
         payout = null

      2. ENTER RESULT NOW
         payout = actual number, including 0
      ========================================================
    */

    if (action === "saveResult") {
      const username = String(body.username || "").trim();

      const slotName = String(body.slotName || body.slot_name || "").trim();

      const platform = String(body.platform || "twitch").trim();

      /*
        IMPORTANT:

        null payout = PENDING bonus

        0 payout = completed bonus that actually paid $0.00

        Any other number = completed payout
      */

      let payout: number | null = null;

      if (
        body.payout !== null &&
        body.payout !== undefined &&
        body.payout !== ""
      ) {
        payout = Number(body.payout);

        if (!Number.isFinite(payout) || payout < 0) {
          return NextResponse.json(
            {
              error: "Invalid payout amount",
            },
            {
              status: 400,
            },
          );
        }
      }

      if (!username || !slotName) {
        return NextResponse.json(
          {
            error: "Missing username or slot name",
          },
          {
            status: 400,
          },
        );
      }

      const { data, error } = await supabase
        .from("slot_call_results")
        .insert({
          username,
          slot_name: slotName,
          platform,
          payout,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        ok: true,
        result: data,
      });
    }

    /*
      ========================================================
      UPDATE / EDIT EXISTING RESULT

      Allows Admin to edit:

      - Pending bonus -> completed payout
      - Existing payout -> corrected payout
      - Username
      - Slot name

      payout can also be set back to null if needed.
      ========================================================
    */

    if (action === "updateResult") {
      const resultId = String(body.resultId || body.id || "").trim();

      const username = String(body.username || "").trim();

      const slotName = String(body.slotName || body.slot_name || "").trim();

      if (!resultId) {
        return NextResponse.json(
          {
            error: "Missing result id",
          },
          {
            status: 400,
          },
        );
      }

      if (!username || !slotName) {
        return NextResponse.json(
          {
            error: "Missing username or slot name",
          },
          {
            status: 400,
          },
        );
      }

      let payout: number | null = null;

      if (
        body.payout !== null &&
        body.payout !== undefined &&
        body.payout !== ""
      ) {
        payout = Number(body.payout);

        if (!Number.isFinite(payout) || payout < 0) {
          return NextResponse.json(
            {
              error: "Invalid payout amount",
            },
            {
              status: 400,
            },
          );
        }
      }

      const { data, error } = await supabase
        .from("slot_call_results")
        .update({
          username,
          slot_name: slotName,
          payout,
        })
        .eq("id", resultId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        ok: true,
        result: data,
      });
    }

    /*
      ========================================================
      NORMAL SLOT CALL ENTRY

      This is the existing chat/viewer entry system.

      Nothing about the bonus-hunt changes should interfere
      with this.
      ========================================================
    */

    const username = String(body.username || "").trim();

    const originalSlotName = String(body.slotName || body.slot_name || "")
      .trim()
      .slice(0, 120);
    const matched = matchSlot(originalSlotName, await catalogue());
    const slotName = matched.game?.name || originalSlotName;
    if (matched.game) {
      const { data: settings, error: settingsError } = await supabase
        .from("site_tracker_settings")
        .select("active_hunt_id")
        .eq("id", true)
        .maybeSingle();
      if (settingsError) throw new Error(settingsError.message);
      if (settings?.active_hunt_id) {
        const { data: duplicate, error } = await supabase
          .from("site_tracker_entries")
          .select("id,identifier,slot_name")
          .eq("hunt_id", settings.active_hunt_id)
          .eq("status", "collected")
          .is("deleted_at", null);
        if (error) throw new Error(error.message);
        if (
          duplicate?.some(
            (e) =>
              e.identifier === matched.game?.identifier ||
              e.slot_name.trim().toLowerCase() ===
                slotName.trim().toLowerCase(),
          )
        )
          return NextResponse.json(
            {
              error: `${slotName} is already in the active hunt. Call ignored.`,
              ignored: true,
            },
            { status: 409 },
          );
      }
    }

    const platform = String(body.platform || "twitch").trim();

    if (!username || !slotName) {
      return NextResponse.json(
        {
          error: "Missing username or slot name",
        },
        {
          status: 400,
        },
      );
    }

    /*
      Prevent the same viewer from having multiple
      active calls on the wheel.
    */

    const { data: existingUser, error: existingUserError } = await supabase
      .from("slot_calls")
      .select("id,slot_name,platform")
      .ilike("username", username)
      .eq("platform", platform)
      .maybeSingle();

    if (existingUserError) {
      return NextResponse.json(
        {
          error: existingUserError.message,
        },
        {
          status: 500,
        },
      );
    }

    /*
      Prevent the exact same slot from being entered
      more than once on the current wheel.
    */

    const { data: existingSlot, error: existingSlotError } = await supabase
      .from("slot_calls")
      .select("id")
      .ilike("slot_name", slotName)
      .maybeSingle();

    if (existingSlotError) {
      return NextResponse.json(
        {
          error: existingSlotError.message,
        },
        {
          status: 500,
        },
      );
    }

    if (existingSlot && existingSlot.id !== existingUser?.id) {
      return NextResponse.json(
        {
          error: `${slotName} is already on the wheel.`,
        },
        {
          status: 400,
        },
      );
    }

    /*
      Create the active wheel entry.
    */

    const write = existingUser
      ? supabase.from("slot_calls").update({ slot_name: slotName, platform }).eq("id", existingUser.id)
      : supabase.from("slot_calls").insert({ username, slot_name: slotName, platform });
    const { data, error } = await write.select().single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        },
      );
    }

    const metadata = await supabase
      .from("roulo_call_matches")
      .upsert({
        call_id: String(data.id),
        original_request: originalSlotName,
        identifier: matched.game?.identifier || null,
        status: matched.status,
        suggestions: matched.suggestions,
      });
    if (metadata.error) {
      if (existingUser) {
        await supabase.from("slot_calls").update({slot_name: existingUser.slot_name, platform: existingUser.platform}).eq("id", data.id);
      } else {
        await supabase.from("slot_calls").delete().eq("id", data.id);
      }
      return NextResponse.json(
        { error: "Catalogue migration is not installed; call was not queued." },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      call: data,
      replaced: Boolean(existingUser),
      needsReview: matched.status === "review",
    });
  } catch (error: any) {
    if (error?.message?.startsWith("AUTH:"))
      return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("POST /api/slot-calls error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while processing the slot call.",
      },
      {
        status: 500,
      },
    );
  }
}

/*
  ============================================================
  DELETE

  Handles:

  - Clear current wheel
  - Clear saved results
  - Delete one saved result
  - Delete one active slot call
  ============================================================
*/

export async function DELETE(req: NextRequest) {
  try {
    await requireTrackerAdmin(req);
    const id = req.nextUrl.searchParams.get("id");

    const clearAll = req.nextUrl.searchParams.get("clearAll") === "true";

    const resultId = req.nextUrl.searchParams.get("resultId");

    const clearResults =
      req.nextUrl.searchParams.get("clearResults") === "true";

    /*
      ========================================================
      CLEAR ALL CURRENT WHEEL ENTRIES
      ========================================================
    */

    if (clearAll) {
      const { error } = await supabase
        .from("slot_calls")
        .delete()
        .not("id", "is", null);

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        ok: true,
        cleared: true,
      });
    }

    /*
      ========================================================
      CLEAR ALL SAVED / ROLLED RESULTS
      ========================================================
    */

    if (clearResults) {
      const { error } = await supabase
        .from("slot_call_results")
        .delete()
        .not("id", "is", null);

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        ok: true,
        resultsCleared: true,
      });
    }

    /*
      ========================================================
      DELETE ONE SAVED / ROLLED RESULT
      ========================================================
    */

    if (resultId) {
      const { error } = await supabase
        .from("slot_call_results")
        .delete()
        .eq("id", resultId);

      if (error) {
        return NextResponse.json(
          {
            error: error.message,
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        ok: true,
        resultDeleted: true,
      });
    }

    /*
      ========================================================
      DELETE ONE CURRENT SLOT CALL

      This is what we use when:

      - Admin manually removes an entry
      - The winner is saved for the bonus hunt
      - A winner DOESN'T GET IN
      - A buy-hunt result is entered

      Once handled, they no longer need to remain on the
      active wheel.
      ========================================================
    */

    if (!id) {
      return NextResponse.json(
        {
          error: "Missing slot call id",
        },
        {
          status: 400,
        },
      );
    }

    const { error } = await supabase.from("slot_calls").delete().eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
    });
  } catch (error: any) {
    if (error?.message?.startsWith("AUTH:"))
      return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("DELETE /api/slot-calls error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while deleting the slot call.",
      },
      {
        status: 500,
      },
    );
  }
}
