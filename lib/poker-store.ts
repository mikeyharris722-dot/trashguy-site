import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { siteDb } from "./site-db";
import { emptyPoker, type PokerState } from "./poker-engine";
export const localPoker = () =>
  process.env.NODE_ENV !== "production" && process.env.POKER_LOCAL === "1";
const file = () => path.join(process.cwd(), ".local", "poker-state.json");
export async function readPoker(): Promise<{
  state: PokerState;
  version: number;
}> {
  if (localPoker()) {
    try {
      return JSON.parse(await fs.readFile(file(), "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        return { state: emptyPoker(), version: 0 };
      throw e;
    }
  }
  const { data, error } = await siteDb()
    .from("poker_state")
    .select("state,version")
    .eq("id", 1)
    .single();
  if (error)
    throw Error(
      "Poker Night storage is unavailable. Please try again shortly.",
    );
  return { state: data.state as PokerState, version: Number(data.version) };
}
const locks = globalThis as typeof globalThis & {
  pokerWrite?: Promise<unknown>;
};
export async function savePoker(
  state: PokerState,
  version: number,
): Promise<boolean> {
  if (localPoker()) {
    const previous = locks.pokerWrite || Promise.resolve();
    let release!: () => void;
    locks.pokerWrite = new Promise<void>((r) => {
      release = r;
    });
    await previous;
    try {
      const current = await readPoker();
      if (current.version !== version) return false;
      await fs.mkdir(path.dirname(file()), { recursive: true });
      const temporary = file() + ".tmp";
      await fs.writeFile(
        temporary,
        JSON.stringify({ state, version: version + 1 }),
        "utf8",
      );
      await fs.rename(temporary, file());
      return true;
    } finally {
      release();
    }
  }
  const { data, error } = await siteDb().rpc("poker_commit", {
    p_expected: version,
    p_state: state,
  });
  if (error)
    throw Error("Poker Night could not save. Please refresh before retrying.");
  return data === true;
}

export async function readPokerVisibility() {
  if (localPoker()) return (await readPoker()).state.enabled === true;
  const { data, error } = await siteDb()
    .from("poker_state")
    .select("enabled:state->enabled")
    .eq("id", 1)
    .single();
  if (error) throw Error("Poker visibility is unavailable.");
  return data.enabled === true;
}
