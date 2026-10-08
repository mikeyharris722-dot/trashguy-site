export const huntTimeZones = [
  "Europe/London",
  "UTC",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
] as const;
function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function localScheduleToUtc(
  input: string,
  timeZone: string,
): string | null {
  if (!input) return null;
  if (!huntTimeZones.includes(timeZone as (typeof huntTimeZones)[number]))
    throw Error("Choose a supported time zone.");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))
    throw Error("Choose a valid date and time.");
  const nominal = new Date(input + ":00.000Z");
  if (
    !Number.isFinite(nominal.getTime()) ||
    nominal.toISOString().slice(0, 16) !== input
  )
    throw Error("Choose a valid date and time.");
  const candidates: string[] = [];
  for (let minutes = -14 * 60; minutes <= 14 * 60; minutes += 15) {
    const date = new Date(nominal.getTime() + minutes * 60000);
    if (dateParts(date, timeZone) === input)
      candidates.push(date.toISOString());
  }
  if (!candidates.length)
    throw Error(
      "That time does not exist because the clocks change. Choose another time.",
    );
  if (candidates.length > 1)
    throw Error(
      "That time occurs twice when the clocks change. Choose another time or use UTC.",
    );
  return candidates[0];
}
export function scheduleInput(
  utc: string | null | undefined,
  timeZone: string,
) {
  return utc ? dateParts(new Date(utc), timeZone) : "";
}
export function scheduleLabel(utc: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(utc));
}
export function validateSchedule(
  utc: unknown,
  timeZone: unknown,
  future = true,
): { scheduledAt: string | null; timeZone: string } {
  const zone = String(timeZone || "Europe/London");
  if (!huntTimeZones.includes(zone as (typeof huntTimeZones)[number]))
    throw Error("Choose a supported time zone.");
  if (utc === null || utc === undefined || utc === "")
    return { scheduledAt: null, timeZone: zone };
  const value = String(utc),
    date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value)
    throw Error("Choose a valid scheduled date and time.");
  if (future && date.getTime() < Date.now() - 60000)
    throw Error("Choose a future date and time, or leave the schedule empty.");
  return { scheduledAt: value, timeZone: zone };
}
