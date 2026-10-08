import { leaderboardPeriod } from "./leaderboard-period";
export type PrizeSettings = {
  leaderboard: number[];
  predictionPrize: number;
  leaderboardStart: string;
  leaderboardEnd: string;
};
export const defaultPrizeSettings: PrizeSettings = {
  leaderboard: [525, 425, 325, 250, 175, 125, 100, 75, 0, 0],
  predictionPrize: 15,
  leaderboardStart: leaderboardPeriod.start,
  leaderboardEnd: leaderboardPeriod.end,
};
export function validatePrizeSettings(value: unknown): PrizeSettings {
  if (!value || typeof value !== "object")
    throw Error("Enter valid prize settings.");
  const input = value as Partial<PrizeSettings>;
  function amount(value: unknown) {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1000000 ||
      Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
    )
      throw Error(
        "Prize amounts must be between $0 and $1,000,000, with up to two decimal places.",
      );
    return value;
  }
  if (!Array.isArray(input.leaderboard) || input.leaderboard.length !== 10)
    throw Error("Enter a prize amount for each of the ten leaderboard places.");
  const start = input.leaderboardStart ?? defaultPrizeSettings.leaderboardStart;
  const end = input.leaderboardEnd ?? defaultPrizeSettings.leaderboardEnd;
  const validDate = (value: unknown): value is string =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(start) || !validDate(end) || end <= start)
    throw Error("Choose a valid leaderboard end date after its start date.");
  return {
    leaderboardStart: start,
    leaderboardEnd: end,
    leaderboard: input.leaderboard.map(amount),
    predictionPrize: amount(input.predictionPrize),
  };
}
export const prizeTotal = (settings: PrizeSettings) =>
  settings.leaderboard.reduce(
    (total, amount) => total + Math.round(amount * 100),
    0,
  ) / 100;

export function resolvedPrizeSettings(settings?: PrizeSettings): PrizeSettings {
  return { ...defaultPrizeSettings, ...settings };
}
