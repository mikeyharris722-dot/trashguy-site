import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { BattleHunt } from "./boss-battle";
const file = path.join(process.cwd(), ".local", "boss-battle-test.json");
let queue: Promise<unknown> = Promise.resolve();
function seed(start = 1000): BattleHunt {
    return { id: "BOSS-TEST", title: "BOSS-TEST · Local hunt", phase: "opening", startCost: start, bonuses: [
            { id: "1", slotName: "Nut Job", username: "Gettyyy_", betSize: 1, payout: null },
            { id: "2", slotName: "Gates of Olympus", username: "Silverbullet", betSize: 1, payout: null },
            { id: "3", slotName: "Le Vampire", username: "Smevy", betSize: 1, payout: null },
            { id: "4", slotName: "Wanted Dead or a Wild", username: "Parz", betSize: 1, payout: null },
            { id: "5", slotName: "Chaos Crew", username: "Twanny", betSize: 1, payout: null },
            { id: "6", slotName: "Duel at Dawn", username: "Gettyyy_", betSize: 1, payout: null },
        ] };
}
export async function readBattleTest(): Promise<BattleHunt> { try {
    return JSON.parse(await fs.readFile(file, "utf8"));
}
catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw e;
    return seed();
} }
export function updateBattleTest(body: Record<string, unknown>) {
    if (process.env.NEXT_PUBLIC_LOCAL_REVIEW !== "1")
        throw Error("Local test only");
    const run = queue.then(async () => {
        let hunt = await readBattleTest();
        if (body.action === "reset") {
            const start = Number(body.start);
            if (!Number.isFinite(start) || start < 1 || start > 1e9)
                throw Error("Enter a positive starting bankroll.");
            hunt = seed(start);
        }
        else if (body.action === "payout") {
            const entry = hunt.bonuses.find(b => b.id === body.id);
            if (!entry)
                throw Error("Unknown bonus");
            const text = String(body.payout ?? "");
            if (!/^\d+(\.\d{1,2})?$/.test(text))
                throw Error("Enter a non-negative payout with up to two decimals.");
            const payout = Number(text);
            if (payout > 1e9)
                throw Error("Payout is too large.");
            entry.openedAt = entry.openedAt || new Date().toISOString();
            entry.payout = payout;
            hunt.phase = hunt.bonuses.every(b => b.payout !== null) ? "finished" : "opening";
        }
        else
            throw Error("Unknown action");
        await fs.mkdir(path.dirname(file), { recursive: true });
        const temporary = file + "." + randomUUID() + ".tmp";
        await fs.writeFile(temporary, JSON.stringify(hunt));
        await fs.rename(temporary, file);
        return hunt;
    });
    queue = run.catch(() => { });
    return run;
}
