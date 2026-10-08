import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, randomInt } from "node:crypto";
import { money, trackerStats } from "./tracker-math";
import games from "@/data/rainbet-community.json";
export type CommunityActor = { id: string; name: string };
type Member = CommunityActor & {
  amount: string;
  status: "pending" | "accepted" | "declined";
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
type Hunt = {
  id: string;
  title: string;
  phase: string;
  limit: number;
  members: Member[];
  calls: Call[];
  entries: Entry[];
  openingQueue: string[];
  createdAt: string;
  deleted: boolean;
};
type State = { hunts: Hunt[]; activeHuntId: string };
const file = path.join(process.cwd(), ".local", "community-hunts.json");
export const communityEnabled = () =>
  process.env.COMMUNITY_HUNT_LOCAL === "1" &&
  process.env.NODE_ENV !== "production";
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
  if (!communityEnabled())
    throw Error("Community Hunt is available only in the local test build.");
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return { hunts: [], activeHuntId: "" };
    throw e;
  }
}
function start(h: Hunt) {
  return h.members
    .filter((m) => m.status === "accepted")
    .reduce((v, m) => v + money(m.amount), BigInt(0));
}
export function communityTracker(h: Hunt) {
  const entries = h.entries.filter((e) => !e.deleted_at);
  return {
    id: h.id,
    local_id: h.id,
    external_hunt_id: null,
    source: "community",
    title: h.title,
    casino: "Rainbet",
    startCost: Number(start(h)) / 1e6,
    status: h.phase === "finished" ? "completed" : "open",
    phase: h.phase,
    isOpening: h.phase === "opening",
    prediction_status: h.phase === "collecting" ? "open" : "locked",
    createdAt: h.createdAt,
    updatedAt: h.createdAt,
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
export async function rainbetGames(q: string) {
  const games = await localCatalogue();
  const query = q.trim().toLowerCase();
  return games
    .filter((g) => !query || g.name.toLowerCase().includes(query))
    .slice(0, 30);
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
      const games = await localCatalogue();
      const s = await communityState();
      const action = String(b.action);
      let h = s.hunts.find((h) => h.id === b.huntId && !h.deleted);
      let result = "";
      const staff = () => {
        if (!admin) throw Error("AUTH: Admin access required.");
      };
      if (action === "clearSelection") {
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
        h = {
          id: randomUUID(),
          title,
          phase: "collecting",
          limit,
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
        } else if (action === "register") {
          if (h.phase !== "collecting") throw Error("Registration is closed.");
          if (
            h.members.some((m) => m.id === actor.id && m.status !== "declined")
          )
            throw Error("You are already registered.");
          const amount = String(b.amount);
          if (
            money(amount) <= BigInt(0) ||
            money(amount) > BigInt("1000000000000000000")
          )
            throw Error("Enter a positive contribution.");
          h.members = h.members.filter((m) => m.id !== actor.id);
          h.members.push({ ...actor, amount, status: "pending" });
        } else if (action === "approve" || action === "decline") {
          staff();
          if (h.phase !== "collecting")
            throw Error("Contributions are frozen during opening.");
          const m = h.members.find(
            (m) => m.id === b.userId && m.status === "pending",
          );
          if (!m) throw Error("Registration has already been handled.");
          m.status = action === "approve" ? "accepted" : "declined";
        } else if (action === "submit" || action === "hostCall") {
          if (h.phase !== "collecting") throw Error("Calls are closed.");
          const member = h.members.find(
            (m) => m.id === actor.id && m.status === "accepted",
          );
          if (action === "hostCall") staff();
          else if (!member)
            throw Error("Join the hunt and wait for admin approval first.");
          const game = games.find((g) => g.identifier === b.identifier);
          if (!game) throw Error("Select a Rainbet catalogue slot.");
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
                c.userId === actor.id &&
                ["queued", "selected"].includes(c.status),
            ).length >= h.limit
          )
            throw Error(
              "Your call spaces are full. A Passed or Failed result releases a space.",
            );
          h.calls.push({
            id: randomUUID(),
            userId: actor.id,
            username: actor.name,
            identifier: game.identifier,
            slot_name: game.name,
            artwork_url: game.artwork_url,
            launch: validLaunch(game.rainbet_launch_url)
              ? game.rainbet_launch_url
              : null,
            status: "queued",
          });
        } else if (action === "withdraw") {
          const c = h.calls.find((c) => c.id === b.callId);
          if (!c || c.userId !== actor.id || c.status !== "queued")
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
                !e.deleted_at && e.status === "collected" && e.payout === null,
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
            if (money(b.bet) <= BigInt(0)) throw Error("Enter a positive bet.");
            if (b.payout !== null) money(b.payout);
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
            if (c) c.status = "queued";
          } else if (action === "edit") {
            const title = String(b.title || "").trim();
            if (!title || title.length > 160) throw Error("Enter a title");
            h.title = title;
          } else if (action === "manual") {
            const game = games.find((g) => g.identifier === b.identifier);
            if (!game || h.phase !== "collecting" || money(b.bet) <= BigInt(0))
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
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = file + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(s, null, 2));
      await fs.rename(tmp, file);
      return result;
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
  try {
    return JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), ".local", "rainbet-catalogue.json"),
        "utf8",
      ),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return games;
    throw e;
  }
}
