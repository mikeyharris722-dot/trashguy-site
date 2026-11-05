export const VIP_WAGER_REQUIREMENT = 10_000;
/** Preserve eligibility earned before the November 2026 requirement change. */
export function previousVipRequirement(periodEnd:string):number {
  return periodEnd <= '2026-11-05' ? 5_000 : VIP_WAGER_REQUIREMENT;
}
