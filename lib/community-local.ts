import {huntCurrency,type HuntCurrency} from './hunt-currency';
import { communityBankroll } from './community-equity';
import { communityFx } from './community-fx';
import { providerName } from './slot-providers';
async function rouloGames(){return (await import('./roulo-catalogue')).catalogue();}
import "server-only";
import {
  readDocument,
  commitDocument,
  receipt,
  requestKey,
} from "./community-store";
import { randomUUID, randomInt } from "node:crypto";
import { money, trackerStats } from "./tracker-math";
import games from "@/data/rainbet-community.json";
import { matchSlot, normaliseSlot } from "./slot-matching";
import { validatePrizeSettings, defaultPrizeSettings, type PrizeSettings } from "./prize-settings";
import { validateSchedule } from "./community-schedule";
type CommunityGame={identifier:string;name:string;provider:string;artwork_url:string|null;rainbet_launch_url?:string|null};
export type CommunityActor = { id: string; name: string; twitchId?: string };
export function communityMemberId(h: {members: {id:string;twitchId?:string}[]}, actor: CommunityActor) {
  return h.members.find(m=>m.id===actor.id || (!!actor.twitchId && /^\d+$/.test(actor.twitchId) && m.twitchId===actor.twitchId))?.id || actor.id;
}
type Member = CommunityActor & {
  amount: string;
  status: "pending" | "accepted" | "declined" | "withdrawn";
};
type Call = {
  id: string;
  userId: string;
  username: string;
  identifier: string;
  slot_name: string;
  artwork_url: string | null;
  launch: string | null;
  status: string;
};
type Entry = {
  id: string;
  call_id: string;
  identifier: string;
  slot_name: string;
  username: string;
  status: string;
  bet_size: string;
  payout: string | null;
  collection_cost: string;
  bonus_tier: string;
  notes: string;
  artwork_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
type Prediction = { userId: string; username: string; amount: string; createdAt: string };
type Hunt = {
  currency?: HuntCurrency;
  equityRate?: string;
  equityRateSavedAt?: string;
  equityRateDate?: string;
  equityRateSource?: string;
  catalogue?: "rainbet"|"roulobets";
  id: string;
  title: string;
  phase: string;
  limit: number;
  members: Member[];
  calls: Call[];
  entries: Entry[];
  openingQueue: string[];
  createdAt: string;
  updatedAt?: string;
  scheduledAt?: string | null;
  timeZone?: string;
  predictions?: Prediction[];
  predictionsClosed?: boolean;
  predictionPrize?: number;
  deleted: boolean;
};
type State = { hunts: Hunt[]; activeHuntId: string; prizeSettings?: PrizeSettings };
export const communityEnabled = () => true;
export function validLaunch(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 2048 &&
    /^https:\/\/(www\.)?rainbet\.com\/([a-z]{2}(-[A-Z]{2})?\/)?casino\/slots\/[A-Za-z0-9][A-Za-z0-9-]*$/.test(
      value,
    )
  );
}
export async function communityState(): Promise<State> {
  return (await readDocument<State>("hunts", { hunts: [], activeHuntId: "" }))
    .payload;
}

function approvedUsd(h: Hunt) {
  return h.members
    .filter((m) => m.status === "accepted")
    .reduce((v, m) => v + money(m.amount), BigInt(0));
}
function start(h: Hunt) {
  // Preserve historical hunts without a saved rate; do not invent an FX rate.
  return h.equityRate ? communityBankroll(approvedUsd(h), h.equityRate) : approvedUsd(h);
}
function requireEquityRate(h: Hunt) {
  if (huntCurrency(h.currency) !== 'USD' && !h.equityRate)
    throw Error('An admin must save the USD equity exchange rate in Edit hunt details first.');
}
export function communityTracker(h: Hunt) {
  const entries = h.entries.filter((e) => !e.deleted_at);
  return {
    id: h.id,
    local_id: h.id,
    external_hunt_id: null,
    source: "community",
    title: h.title,
    casino: h.catalogue==='roulobets'?'Roulobets':'Rainbet',
    currency:h.currency||'USD',
    catalogue:h.catalogue||'rainbet',
    equityCurrency: 'USD',
    equityRate: h.equityRate || (huntCurrency(h.currency) === 'USD' ? '1' : null),
    equityRateSavedAt: h.equityRateSavedAt || null,
    equityRateDate: h.equityRateDate || null,
    equityRateSource: h.equityRateSource || null,
    approvedEquityUsd: Number(approvedUsd(h)) / 1e6,
    startCost: Number(start(h)) / 1e6,
    status: h.phase === "finished" ? "completed" : "open",
    phase: h.phase,
    isOpening: h.phase === "opening",
    prediction_status: h.predictionsClosed === false ? "open" : "locked",
    createdAt: h.createdAt,
    updatedAt: h.updatedAt || h.createdAt,
    scheduledAt: h.scheduledAt || null,
    timeZone: h.timeZone || "Europe/London",
    entries,
    openingQueue: h.openingQueue,
    stats: trackerStats((Number(start(h)) / 1e6).toFixed(6), entries),
    bonuses: entries
      .filter((e) => e.status === "collected")
      .map((e, i) => ({
        id: e.id,
        slotName: e.slot_name,
        provider: "",
        slotImage: e.artwork_url || "",
        betSize: Number(e.bet_size),
        payout: e.payout === null ? null : Number(e.payout),
        multiplier:
          e.payout === null ? 0 : Number(e.payout) / Number(e.bet_size),
        note: e.username,
        order: i,
        createdAt: e.created_at,
      })),
  };
}
export async function rainbetGames(q: string,huntId?:string) {
  const h=huntId?(await communityState()).hunts.find(h=>h.id===huntId&&!h.deleted):undefined;
  if(huntId&&!h)throw Error('Choose an existing community hunt.');
  const games = h?.catalogue==='roulobets'?(await rouloGames()).filter(g=>g.enabled!==false):await localCatalogue();
  const query = normaliseSlot(q);
  if (!query) return [];
  const matched = matchSlot(q, games);
  const contained = games.filter((g) =>
    normaliseSlot(g.name + " " + g.provider).includes(query),
  );
  return [
    ...new Map(
      [...contained, ...(matched.suggestions || [])].map((g) => [
        g.identifier,
        g,
      ]),
    ).values(),
  ].slice(0, 30);
}
// A process-wide queue survives development hot reload and serializes local edits.
const key = Symbol.for("trashguy.community.write");
const locks = globalThis as typeof globalThis & {
  [key]: Promise<unknown> | undefined;
};
export async function communityCommand(
  actor: CommunityActor,
  admin: boolean,
  b: Record<string, unknown>,
) {
  const previous = locks[key] || Promise.resolve();
  const task = previous
    .catch(() => {})
    .then(async () => {
      const key = requestKey(b, actor.id, "hunts");
      for (let attempt = 0; attempt < 12; attempt++) {
        const replay = await receipt("hunts", actor.id, key);
        if (replay) return String(replay.result);
        const snapshot = await readDocument<State>("hunts", {
          hunts: [],
          activeHuntId: "",
        });
        const s = snapshot.payload;
        const action = String(b.action);
        let h = s.hunts.find((h) => h.id === b.huntId && !h.deleted);
        const memberId = h ? communityMemberId(h,actor) : actor.id;
        const games:CommunityGame[]=action==='navigationVisibility'?[]:h?.catalogue==='roulobets'?(await rouloGames()).filter(g=>g.enabled!==false):await localCatalogue();
        let result = "";
        const staff = () => {
          if (!admin) throw Error("AUTH: Admin access required.");
        };
        if(action === "navigationVisibility") {
          staff();
          if(!["tournaments","community"].includes(String(b.section))||typeof b.enabled!=="boolean")throw Error("Choose valid public menu visibility.");
          const previous=s.prizeSettings||defaultPrizeSettings;
          s.prizeSettings={...previous,navigation:{...defaultPrizeSettings.navigation!,...previous.navigation,[String(b.section)]:b.enabled}};
        } else if (action === "prizeSettings") {
          staff();
          const previous=s.prizeSettings||defaultPrizeSettings,next=validatePrizeSettings(b.settings);
          next.leaderboardArchives=[...(previous.leaderboardArchives||defaultPrizeSettings.leaderboardArchives||[]).filter(p=>!next.leaderboardArchives?.some(n=>n.start===p.start)),...(next.leaderboardArchives||[])];
          if(previous.leaderboardStart!==next.leaderboardStart||previous.leaderboardEnd!==next.leaderboardEnd){
            next.leaderboardArchives=[...(next.leaderboardArchives||[]).filter(p=>p.start!==previous.leaderboardStart),{start:previous.leaderboardStart,end:previous.leaderboardEnd,prizes:[...previous.leaderboard]}];
          }
          next.navigation=previous.navigation??defaultPrizeSettings.navigation;
          s.prizeSettings = next;
        } else if (action === "clearSelection") {
          staff();
          s.activeHuntId = "";
        } else if (action === "create") {
          staff();
          const title = String(b.title || "").trim();
          const limit = Number(b.limit || 3);
          if (
            !title ||
            title.length > 160 ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 10
          )
            throw Error("Enter a title and a call limit from 1 to 10.");
          if(b.catalogue!==undefined&&!['rainbet','roulobets'].includes(String(b.catalogue)))throw Error('Choose Rainbet or Roulobets.');
          h = {
            id: randomUUID(),
            title,
            currency:huntCurrency(b.currency),
            ...await communityFx(b.currency),
            equityRateSavedAt:new Date().toISOString(),
            catalogue:b.catalogue==='roulobets'?'roulobets':'rainbet',
            ...validateSchedule(b.scheduledAt, b.timeZone),
            phase: "collecting",
            limit,
            predictions: [],
            predictionsClosed: true,
            predictionPrize: (s.prizeSettings || defaultPrizeSettings).predictionPrize,
            members: [],
            calls: [],
            entries: [],
            openingQueue: [],
            createdAt: new Date().toISOString(),
            deleted: false,
          };
          s.hunts.unshift(h);
          s.activeHuntId = h.id;
          result = h.id;
        } else {
          if (!h) throw Error("Choose a community hunt.");
          if (action === "select") {
            staff();
            s.activeHuntId = h.id;
          } else if (action === "delete") {
            staff();
            if (b.confirmTitle !== h.title)
              throw Error("Type the hunt title to delete it.");
            h.deleted = true;
            if (s.activeHuntId === h.id) s.activeHuntId = "";
          } else if (action === "predict") {
            if (h.predictionsClosed !== false) throw Error("Predictions are closed for this hunt.");
            const amount = String(b.amount ?? "");
            if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || money(amount) > BigInt("1000000000000"))
              throw Error("Enter a prediction from $0 to $1,000,000 with up to two decimal places.");
            const predictions = h.predictions ||= [];
            const existing = predictions.find((p) => p.userId === actor.id);
            if (existing) existing.amount = amount;
            else predictions.push({ userId: actor.id, username: actor.name, amount, createdAt: new Date().toISOString() });
          } else if (action === "predictionStatus") {
            staff();
            h.predictionsClosed = b.closed !== false;
          } else if (action === "addApprovedPlayer") {
            staff();
            if (h.phase !== 'collecting') throw Error('Players can only be added during registration and collection.');
            requireEquityRate(h);
            const amount = String(b.amount ?? '');
            if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || money(amount) <= BigInt(0) || money(amount) > BigInt('1000000000000000000'))
              throw Error('Enter a positive USD contribution with up to two decimal places.');
            const player = await (await import('./community-player')).communityPlayer(b.userId);
            const existingId = communityMemberId(h,player);
            if (h.members.some(m=>m.id===existingId && ['pending','accepted'].includes(m.status)))
              throw Error('This player is already registered. Review their existing request instead.');
            h.members = h.members.filter(m=>m.id!==existingId);
            h.members.push({...player, amount, status:'accepted'});
          } else if (action === "register") {
            requireEquityRate(h);
            if (h.phase !== "collecting")
              throw Error("Registration is closed.");
            if (
              h.members.some(
                (m) =>
                  m.id === memberId &&
                  ["pending", "accepted"].includes(m.status),
              )
            )
              throw Error("You are already registered.");
            const amount = String(b.amount);
            if (
              money(amount) <= BigInt(0) ||
              money(amount) > BigInt("1000000000000000000")
            )
              throw Error("Enter a positive contribution.");
            h.members = h.members.filter((m) => m.id !== memberId);
            h.members.push({ ...actor, amount, status: "pending" });
          } else if (
            action === "updateContribution" ||
            action === "cancelRegistration"
          ) {
            if (h.phase !== "collecting")
              throw Error("Registration is closed.");
            const m = h.members.find(
              (m) => m.id === memberId && m.status === "pending",
            );
            if (!m)
              throw Error(
                "Only a pending registration can be changed. Contact the streamer about an approved contribution.",
              );
            if (action === "cancelRegistration") m.status = "withdrawn";
            else {
              requireEquityRate(h);
              const amount = String(b.amount);
              if (
                money(amount) <= BigInt(0) ||
                money(amount) > BigInt("1000000000000000000")
              )
                throw Error("Enter a positive contribution.");
              m.amount = amount;
            }
          } else if (action === "approve" || action === "decline") {
            staff();
            if (h.phase !== "collecting")
              throw Error("Contributions are frozen during opening.");
            const m = h.members.find(
              (m) => m.id === b.userId && m.status === "pending",
            );
            if (!m) throw Error("Registration has already been handled.");
            if (action === "approve") requireEquityRate(h);
            m.status = action === "approve" ? "accepted" : "declined";
          } else if (action === "submit" || action === "hostCall") {
            if (h.phase !== "collecting") throw Error("Calls are closed.");
            const member = h.members.find(
              (m) => m.id === memberId && m.status === "accepted",
            );
            if (action === "hostCall") staff();
            else if (!member)
              throw Error("Join the hunt and wait for admin approval first.");
            const game = games.find((g) => g.identifier === b.identifier);
            if (!game) throw Error("Select a slot from this hunt’s catalogue.");
            if (
              h.calls.some(
                (c) =>
                  c.identifier === game.identifier &&
                  !["failed", "withdrawn"].includes(c.status),
              ) ||
              h.entries.some(
                (e) =>
                  !e.deleted_at &&
                  e.status === "collected" &&
                  e.identifier === game.identifier,
              )
            )
              throw Error("This slot is already called or in the hunt.");
            if (
              action === "submit" &&
              h.calls.filter(
                (c) =>
                  c.userId === memberId &&
                  ["queued", "selected"].includes(c.status),
              ).length >= h.limit
            )
              throw Error(
                "Your call spaces are full. A Passed or Failed result releases a space.",
              );
            h.calls.push({
              id: randomUUID(),
              userId: memberId,
              username: actor.name,
              identifier: game.identifier,
              slot_name: game.name,
              artwork_url: game.artwork_url,
              launch: h.catalogue==='roulobets'?'https://roulobets.com/casino/slots/'+encodeURIComponent(game.identifier).replace(/%3A/gi,':'):validLaunch(game.rainbet_launch_url)
                ? game.rainbet_launch_url
                : null,
              status: "queued",
            });
          } else if (action === "withdraw") {
            if (h.phase !== "collecting")
              throw Error("Calls are closed during opening.");
            const c = h.calls.find((c) => c.id === b.callId);
            if (!c || c.userId !== memberId || c.status !== "queued")
              throw Error("Only your queued call can be withdrawn.");
            c.status = "withdrawn";
          } else if (action === "random") {
            staff();
            if (h.phase !== "collecting") throw Error("Calls are closed.");
            if (h.calls.some((c) => c.status === "selected"))
              throw Error("Resolve the selected call first.");
            const queue = h.calls.filter((c) => c.status === "queued");
            if (!queue.length) throw Error("No calls queued.");
            queue[randomInt(queue.length)].status = "selected";
          } else if (action === "result") {
            staff();
            if (h.phase !== "collecting") throw Error("Calls are closed.");
            const c = h.calls.find(
              (c) =>
                c.id === b.callId && ["queued", "selected"].includes(c.status),
            );
            if (!c) throw Error("Call already handled.");
            const status = String(b.status);
            if (!["collected", "failed"].includes(status))
              throw Error("Invalid result.");
            const bet = String(b.bet || "0");
            if (money(bet) > BigInt("1000000000000"))
              throw Error("Bet is too large.");
            if (status === "collected" && money(bet) <= BigInt(0))
              throw Error("Enter a positive bet size.");
            if (
              status === "collected" &&
              h.entries.some(
                (e) =>
                  !e.deleted_at &&
                  e.status === "collected" &&
                  e.identifier === c.identifier,
              )
            )
              throw Error("This slot is already in the hunt.");
            c.status = status;
            const now = new Date().toISOString();
            h.entries.push({
              id: randomUUID(),
              call_id: c.id,
              identifier: c.identifier,
              slot_name: c.slot_name,
              username: c.username,
              status,
              bet_size: status === "collected" ? bet : "0",
              payout: null,
              collection_cost: "0",
              bonus_tier: "standard",
              notes: "",
              artwork_url: c.artwork_url,
              sort_order: h.entries.length,
              created_at: now,
              updated_at: now,
              deleted_at: null,
            });
          } else {
            staff();
            const entry = h.entries.find(
              (e) => e.id === b.entryId && !e.deleted_at,
            );
            if (
              h.phase === "finished" &&
              action !== "phase" &&
              action !== "edit"
            )
              throw Error("Reopen the hunt before editing its results.");
            if (action === "phase") {
              if (
                !["collecting", "opening", "finished"].includes(String(b.phase))
              )
                throw Error("Invalid phase.");
              if (
                b.phase === "finished" &&
                h.entries.some(
                  (e) =>
                    !e.deleted_at &&
                    e.status === "collected" &&
                    e.payout === null,
                )
              )
                throw Error("Enter all payouts before finishing.");
              if (b.phase === "opening") requireEquityRate(h);
              h.phase = String(b.phase);
            } else if (action === "reorder") {
              if (h.phase !== "collecting")
                throw Error("Order is locked during opening.");
              const ids = b.entryIds as string[];
              const rows = h.entries.filter(
                (e) => !e.deleted_at && e.status === "collected",
              );
              if (
                !Array.isArray(ids) ||
                new Set(ids).size !== rows.length ||
                ids.length !== rows.length ||
                ids.some((id) => !rows.some((e) => e.id === id))
              )
                throw Error("The hunt changed. Refresh and retry.");
              ids.forEach((id, i) => {
                h!.entries.find((e) => e.id === id)!.sort_order = i;
              });
              h.entries.sort((a, b) => a.sort_order - b.sort_order);
            } else if (action === "openingFocus") {
              if (h.phase !== "opening") throw Error("Start opening first.");
              const ids = b.entryIds as string[];
              const pending = h.entries.filter(
                (e) =>
                  !e.deleted_at &&
                  e.status === "collected" &&
                  e.payout === null,
              );
              if (
                !Array.isArray(ids) ||
                ids.length !== pending.length ||
                new Set(ids).size !== ids.length ||
                ids.some((id) => !pending.some((e) => e.id === id))
              )
                throw Error("The opening queue changed. Reopen it.");
              h.openingQueue = ids;
            } else if (action === "payout") {
              if (!entry || entry.status !== "collected")
                throw Error("Bonus not found.");
              if (money(b.bet) <= BigInt(0))
                throw Error("Enter a positive bet.");
              if (money(b.bet) > BigInt("1000000000000"))
                throw Error("Bet is too large.");
              if (
                b.payout !== null &&
                money(b.payout) > BigInt("1000000000000000")
              )
                throw Error("Payout is too large.");
              entry.bet_size = String(b.bet);
              entry.payout = b.payout === null ? null : String(b.payout);
              if (b.tier !== undefined) {
                if (
                  !["standard", "super", "super_super"].includes(String(b.tier))
                )
                  throw Error("Invalid tier");
                entry.bonus_tier = String(b.tier);
              }
              if (b.notes !== undefined) {
                if (String(b.notes).length > 2000)
                  throw Error("Notes are too long");
                entry.notes = String(b.notes);
              }
              entry.updated_at = new Date().toISOString();
            } else if (action === "removeEntry") {
              if (!entry) throw Error("Bonus not found.");
              entry.deleted_at = new Date().toISOString();
              const c = h.calls.find((c) => c.id === entry.call_id);
              if (c) c.status = "withdrawn";
            } else if (action === "undo") {
              if (h.phase !== "collecting" || !entry || entry.payout !== null)
                throw Error(
                  "Undo is only available before payout during collection.",
                );
              entry.deleted_at = new Date().toISOString();
              const c = h.calls.find((c) => c.id === entry.call_id);
              if (c) {
                if (
                  h.calls.some(
                    (other) =>
                      other.id !== c.id &&
                      other.identifier === c.identifier &&
                      ["queued", "selected", "collected"].includes(
                        other.status,
                      ),
                  )
                )
                  throw Error("This slot is already called or in the hunt.");
                c.status = "queued";
              }
            } else if (action === "edit") {
              if (b.catalogue !== undefined) {
                if (!['rainbet', 'roulobets'].includes(String(b.catalogue))) throw Error('Choose Rainbet or Roulobets.');
                if (b.catalogue !== (h.catalogue || 'rainbet')) {
                  if (h.phase === 'finished') throw Error('Reopen the hunt before changing its catalogue.');
                  const targetCatalogue = b.catalogue as 'rainbet' | 'roulobets';
                  const targetGames: CommunityGame[] = targetCatalogue === 'roulobets'
                    ? (await rouloGames()).filter(g => g.enabled !== false) : await localCatalogue();
                  if (!targetGames.length) throw Error('The new catalogue is unavailable. No calls were changed.');
                  let kept = 0, removed = 0;
                  for (const call of h.calls.filter(c => ['queued', 'selected'].includes(c.status))) {
                    const original = games.find(g => g.identifier === call.identifier);
                    const candidates = targetGames.filter(g => normaliseSlot(g.name) === normaliseSlot(call.slot_name)
                      && (!original || normaliseSlot(providerName(g.provider)) === normaliseSlot(providerName(original.provider))));
                    if (candidates.length !== 1) {
                      // Retain history but remove unavailable or ambiguous calls from the queue.
                      call.status = 'withdrawn';
                      removed++;
                      continue;
                    }
                    const game = candidates[0];
                    call.identifier = game.identifier;
                    call.slot_name = game.name;
                    call.artwork_url = game.artwork_url;
                    call.launch = targetCatalogue === 'roulobets'
                      ? 'https://roulobets.com/casino/slots/' + encodeURIComponent(game.identifier).replace(/%3A/gi, ':')
                      : validLaunch(game.rainbet_launch_url) ? game.rainbet_launch_url : null;
                    kept++;
                  }
                  h.catalogue = targetCatalogue;
                  result = `Catalogue changed. ${kept} call${kept === 1 ? '' : 's'} kept; ${removed} removed from the queue.`;
                }
              }
              if (b.refreshEquityRate === true) {
                if (h.phase === 'finished' || (h.equityRate && (h.phase !== 'collecting' ||
                  h.entries.some(e => e.payout !== null) || h.members.some(m => m.status === 'accepted'))))
                  throw Error('The equity exchange rate is locked after approval or opening.');
                Object.assign(h, await communityFx(h.currency));
                h.equityRateSavedAt = new Date().toISOString();
              }
              if (b.equityRate !== undefined) throw Error('Exchange rates are looked up automatically. Use Update exchange rate.');
              const title = String(b.title || "").trim();
              if (!title || title.length > 160) throw Error("Enter a title");
              h.title = title;
              if (b.scheduledAt !== undefined || b.timeZone !== undefined)
                Object.assign(
                  h,
                  validateSchedule(
                    b.scheduledAt,
                    b.timeZone,
                    b.scheduledAt !== h.scheduledAt,
                  ),
                );
              if (b.limit !== undefined) {
                const limit = Number(b.limit);
                if (!Number.isInteger(limit) || limit < 1 || limit > 10)
                  throw Error("Call spaces must be between 1 and 10.");
                const counts = new Map<string, number>();
                for (const c of h.calls.filter((c) =>
                  ["queued", "selected"].includes(c.status),
                ))
                  counts.set(c.userId, (counts.get(c.userId) || 0) + 1);
                if ([...counts.values()].some((count) => count > limit))
                  throw Error(
                    "A player has more queued calls than that limit. Resolve their calls first.",
                  );
                h.limit = limit;
              }
            } else if (action === "manual") {
              const game = games.find((g) => g.identifier === b.identifier);
              if (
                !game ||
                h.phase !== "collecting" ||
                money(b.bet) <= BigInt(0)
              )
                throw Error("Select a slot and positive bet while collecting.");
              if (
                h.entries.some(
                  (e) =>
                    !e.deleted_at &&
                    e.status === "collected" &&
                    e.identifier === game.identifier,
                )
              )
                throw Error("This slot is already in the hunt.");
              if (money(b.bet) > BigInt("1000000000000"))
                throw Error("Bet is too large.");
              if (
                h.calls.some(
                  (c) =>
                    c.identifier === game.identifier &&
                    ["queued", "selected"].includes(c.status),
                )
              )
                throw Error(
                  "This slot is already called. Mark that call as Passed instead.",
                );
              const now = new Date().toISOString();
              h.entries.push({
                id: randomUUID(),
                call_id: "",
                identifier: game.identifier,
                slot_name: game.name,
                username: actor.name,
                status: "collected",
                bet_size: String(b.bet),
                payout: null,
                collection_cost: "0",
                bonus_tier: ["standard", "super", "super_super"].includes(
                  String(b.tier),
                )
                  ? String(b.tier)
                  : "standard",
                notes: String(b.notes || "").slice(0, 2000),
                artwork_url: game.artwork_url,
                sort_order: h.entries.length,
                created_at: now,
                updated_at: now,
                deleted_at: null,
              });
            } else throw Error("Unknown action");
          }
        }
        if (h) h.updatedAt = new Date().toISOString();
        const saved = await commitDocument(
          "hunts",
          s,
          snapshot.version,
          result,
          actor.id,
          key,
        );
        if (saved.committed) return String(saved.result);
      }
      throw Error("The hunt is busy. Please retry your action.");
    });
  locks[key] = task;
  return task;
}

export async function localCatalogue(): Promise<
  {
    identifier: string;
    name: string;
    provider: string;
    artwork_url: string | null;
    rainbet_launch_url: string | null;
  }[]
> {
  const { payload } = await readDocument<typeof games>("catalogue", games);
  return payload.length ? payload : games;
}
