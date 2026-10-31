import {defaultWeeklyWager,validateWeeklyWager,type WeeklyWagerSettings} from "./weekly-wager";
import {defaultBossTargets,type BossTarget} from "./trash-bosses";
import { leaderboardPeriod } from "./leaderboard-period";
export type PrizeSettings = {
  navigation?: {tournaments:boolean;community:boolean};
  trashClaw?: {prizes:string[];cashEntries:number[]};
  leaderboard: number[];
  weeklyWager?: WeeklyWagerSettings;
  leaderboardArchives?: {start:string;end:string;prizes:number[]}[];
  leaderboardWeighting?: string;
  trashBosses?: BossTarget[];
  trashBossesEnabled?: boolean;
  predictionPrize: number;
  leaderboardStart: string;
  leaderboardEnd: string;
};
export const defaultPrizeSettings: PrizeSettings = {
  navigation: {tournaments:true,community:true},
  leaderboard: [525, 425, 325, 250, 175, 125, 100, 75, 0, 0],
  leaderboardArchives: [{start:"2026-09-05",end:"2026-10-05",prizes:[400,350,300,200,150,100,0,0,0,0]}],
  weeklyWager:defaultWeeklyWager,
  predictionPrize: 15,
  leaderboardWeighting: "RTP ≤97% → 100% contribution\nRTP >97% and <98% → 50% contribution\nRTP ≥98% → 10% contribution",
  trashBosses: defaultBossTargets,
  trashBossesEnabled: false,
  leaderboardStart: leaderboardPeriod.start,
  leaderboardEnd: leaderboardPeriod.end,
};
export function validatePrizeSettings(value: unknown): PrizeSettings {
  if (!value || typeof value !== "object")
    throw Error("Enter valid prize settings.");
  const input = value as Partial<PrizeSettings>;
  const navigation=input.navigation??defaultPrizeSettings.navigation!;
  if(!navigation||typeof navigation.tournaments!=="boolean"||typeof navigation.community!=="boolean")throw Error("Public menu visibility must be on or off.");
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
  if(input.trashBossesEnabled!==undefined&&typeof input.trashBossesEnabled!=="boolean")throw Error("Trash Bosses activation must be on or off.");
  const bosses=input.trashBosses??defaultBossTargets;
  if(!Array.isArray(bosses)||bosses.length!==3)throw Error("Configure exactly three Trash Bosses.");
  const checked=bosses.map(b=>({target:amount(b.target),reward:amount(b.reward)}));
  if(checked.some((b,i)=>b.target<=0||(i>0&&b.target<=checked[i-1].target)))throw Error("Boss targets must be positive and increase from Boss 1 to Boss 3.");
  const archives=input.leaderboardArchives??defaultPrizeSettings.leaderboardArchives??[];
  if(!Array.isArray(archives)||archives.length>120)throw Error('Invalid leaderboard history.');
  const checkedArchives=archives.map(p=>{if(!validDate(p.start)||!validDate(p.end)||p.end<=p.start||!Array.isArray(p.prizes)||p.prizes.length!==10)throw Error('Invalid archived leaderboard prizes.');return {start:p.start,end:p.end,prizes:p.prizes.map(amount)};});
  if(new Set(checkedArchives.map(p=>p.start)).size!==checkedArchives.length)throw Error('Duplicate leaderboard archive.');
  const weighting=input.leaderboardWeighting??defaultPrizeSettings.leaderboardWeighting??'';
  if(typeof weighting!=='string'||weighting.length>2000)throw Error('Weighting rules must be under 2,000 characters.');
  const claw=input.trashClaw;
  if(claw&&(!Array.isArray(claw.prizes)||claw.prizes.length!==10||claw.prizes.some(p=>typeof p!=='string'||p.length>60)||!Array.isArray(claw.cashEntries)||claw.cashEntries.length<2||claw.cashEntries.length>100||claw.cashEntries.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<=0||n>1000000||Math.abs(n*100-Math.round(n*100))>0.00001)))throw Error('Enter 10 prize names and 2–100 positive wheel amounts with up to two decimal places.');
  return {
    navigation:{tournaments:navigation.tournaments,community:navigation.community},
    ...(claw?{trashClaw:{prizes:claw.prizes.map(p=>p.trim()),cashEntries:claw.cashEntries}}:{}),
    weeklyWager:validateWeeklyWager(input.weeklyWager??defaultWeeklyWager),
    leaderboardArchives:checkedArchives,
    leaderboardWeighting:weighting.trim(),
    trashBosses: checked,
    trashBossesEnabled: input.trashBossesEnabled===true,
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
