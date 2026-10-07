export function money(value: unknown): bigint {
  const s = String(value ?? 0);
  if (!/^\d+(?:\.\d{1,6})?$/.test(s))
    throw new Error("Invalid non-negative amount (up to six decimal places).");
  const [whole, part = ""] = s.split(".");
  return BigInt(whole) * BigInt(1000000) + BigInt(part.padEnd(6, "0"));
}
export function trackerStats(
  start: unknown,
  entries: {
    status: string;
    bet_size: unknown;
    payout: unknown;
    collection_cost: unknown;
  }[],
) {
  const collected = entries.filter((e) => e.status === "collected"),
    opened = collected.filter((e) => e.payout !== null),
    remaining = collected.filter((e) => e.payout === null);
  const sum = (
    rows: typeof entries,
    key: "bet_size" | "payout" | "collection_cost",
  ) => rows.reduce((a, e) => a + money(e[key]), BigInt(0));
  const returns = sum(opened, "payout"),
    target = money(start),
    remainingStake = sum(remaining, "bet_size"),
    profit = returns - target;
  return {
    bonusCount: collected.length,
    openedBonuses: opened.length,
    unopenedBonuses: remaining.length,
    totalWinnings: Number(returns) / 1e6,
    profitLoss: Number(profit) / 1e6,
    profitLossPercentage: target ? (Number(profit) * 100) / Number(target) : 0,
    averagePayoutRequired:
      returns >= target
        ? 0
        : remainingStake
          ? Number(target - returns) / Number(remainingStake)
          : null,
    currentAverage: opened.length ? Number(returns) / 1e6 / opened.length : 0,
    averageBetSize: collected.length
      ? Number(sum(collected, "bet_size")) / 1e6 / collected.length
      : 0,
    currentAverageMultiplier: opened.length
      ? opened.reduce(
          (a, e) => a + Number(money(e.payout)) / Number(money(e.bet_size)),
          0,
        ) / opened.length
      : 0,
    collectionCosts: Number(sum(entries, "collection_cost")) / 1e6,
  };
}
