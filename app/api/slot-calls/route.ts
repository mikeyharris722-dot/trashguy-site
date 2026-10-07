import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

/*
  ============================================================
  GET
  LOAD CURRENT SLOT CALLS + SAVED/ROLLED RESULTS
  ============================================================
*/

export async function GET() {
  const [
    { data: calls, error: callsError },
    { data: results, error: resultsError },
  ] = await Promise.all([
    supabase
      .from("slot_calls")
      .select("*")
      .order("created_at", { ascending: true }),

    supabase
      .from("slot_call_results")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  if (callsError) {
    return NextResponse.json(
      {
        error: callsError.message,
      },
      {
        status: 500,
      }
    );
  }

  if (resultsError) {
    return NextResponse.json(
      {
        error: resultsError.message,
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    calls: calls || [],
    results: results || [],
  });
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

      const slotName = String(
        body.slotName || body.slot_name || ""
      ).trim();

      const platform = String(
        body.platform || "twitch"
      ).trim();

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
            }
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
          }
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
          }
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
      const resultId = String(
        body.resultId || body.id || ""
      ).trim();

      const username = String(body.username || "").trim();

      const slotName = String(
        body.slotName || body.slot_name || ""
      ).trim();

      if (!resultId) {
        return NextResponse.json(
          {
            error: "Missing result id",
          },
          {
            status: 400,
          }
        );
      }

      if (!username || !slotName) {
        return NextResponse.json(
          {
            error: "Missing username or slot name",
          },
          {
            status: 400,
          }
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
            }
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
          }
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

    const slotName = String(
      body.slotName || body.slot_name || ""
    ).trim();

    const platform = String(
      body.platform || "twitch"
    ).trim();

    if (!username || !slotName) {
      return NextResponse.json(
        {
          error: "Missing username or slot name",
        },
        {
          status: 400,
        }
      );
    }

    /*
      Prevent the same viewer from having multiple
      active calls on the wheel.
    */

    const { data: existingUser, error: existingUserError } =
      await supabase
        .from("slot_calls")
        .select("id")
        .ilike("username", username)
        .maybeSingle();

    if (existingUserError) {
      return NextResponse.json(
        {
          error: existingUserError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        {
          error: `${username} already has a slot on the wheel.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
      Prevent the exact same slot from being entered
      more than once on the current wheel.
    */

    const { data: existingSlot, error: existingSlotError } =
      await supabase
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
        }
      );
    }

    if (existingSlot) {
      return NextResponse.json(
        {
          error: `${slotName} is already on the wheel.`,
        },
        {
          status: 400,
        }
      );
    }

    /*
      Create the active wheel entry.
    */

    const { data, error } = await supabase
      .from("slot_calls")
      .insert({
        username,
        slot_name: slotName,
        platform,
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
        }
      );
    }

    return NextResponse.json({
      ok: true,
      call: data,
    });
  } catch (error: any) {
    console.error("POST /api/slot-calls error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while processing the slot call.",
      },
      {
        status: 500,
      }
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
    const id = req.nextUrl.searchParams.get("id");

    const clearAll =
      req.nextUrl.searchParams.get("clearAll") === "true";

    const resultId =
      req.nextUrl.searchParams.get("resultId");

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
          }
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
          }
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
          }
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
        }
      );
    }

    const { error } = await supabase
      .from("slot_calls")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
    });
  } catch (error: any) {
    console.error("DELETE /api/slot-calls error:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Something went wrong while deleting the slot call.",
      },
      {
        status: 500,
      }
    );
  }
}