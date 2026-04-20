import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const id = params?.id?.trim();
    const apiKey = process.env.BONUSHUNT_API_KEY;

    if (!id) {
      return NextResponse.json(
        { error: "Missing hunt id." },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing BONUSHUNT_API_KEY." },
        { status: 500 }
      );
    }

    const res = await fetch(`https://bonushunt.gg/api/public/hunts/${id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();

      return NextResponse.json(
        {
          error: `BonusHunt detail API error: ${text}`,
        },
        { status: res.status }
      );
    }

    const data = await res.json();

    const bonuses = Array.isArray(data?.bonuses)
      ? data.bonuses.map((bonus: any, index: number) => ({
          id: bonus?.id || `bonus-${index}`,
          slotName: bonus?.slotName || "---",
          provider: bonus?.provider || "",
          betSize: Number(bonus?.betSize || 0),
          payout: Number(bonus?.payout || 0),
          multiplier: Number(bonus?.multiplier || 0),
        }))
      : [];

    const totalWinnings =
      typeof data?.stats?.totalWinnings !== "undefined"
        ? Number(data.stats.totalWinnings || 0)
        : bonuses.reduce((sum: number, bonus: any) => sum + Number(bonus.payout || 0), 0);

    const bonusCount =
      typeof data?.stats?.bonusCount !== "undefined"
        ? Number(data.stats.bonusCount || 0)
        : bonuses.length;

    const avgMultiplier =
      bonuses.length > 0
        ? bonuses.reduce((sum: number, bonus: any) => sum + Number(bonus.multiplier || 0), 0) /
          bonuses.length
        : 0;

    const bestSlot =
      bonuses.length > 0
        ? [...bonuses].sort((a, b) => b.payout - a.payout)[0]
        : null;

    const highestX =
      bonuses.length > 0
        ? [...bonuses].sort((a, b) => b.multiplier - a.multiplier)[0]
        : null;

    return NextResponse.json({
      success: true,
      hunt: {
        id: data?.id || id,
        title: data?.title || "Bonus Hunt",
        casino: data?.casino || "",
        startCost: Number(data?.startCost || 0),
        isOpening: Boolean(data?.isOpening),
        currentOpeningSlot: data?.currentOpeningSlot || null,
        createdAt: data?.createdAt || null,
        stats: {
          bonusCount,
          totalWinnings,
          profitLoss: Number(data?.stats?.profitLoss || 0),
          avgMultiplier,
        },
        bestSlot: bestSlot
          ? {
              slotName: bestSlot.slotName,
              payout: bestSlot.payout,
              multiplier: bestSlot.multiplier,
            }
          : null,
        highestX: highestX
          ? {
              slotName: highestX.slotName,
              payout: highestX.payout,
              multiplier: highestX.multiplier,
            }
          : null,
        bonuses,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}