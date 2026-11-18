import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { siteDb } from './site-db';
import type { XState } from './x-giveaway';
export const localX = () => process.env.NODE_ENV !== 'production';
const file = () => path.join(process.cwd(), '.local', 'x-giveaways.json');
type Document = {
    state: XState;
    version: number;
};
export async function readX(): Promise<Document> {
    if (localX()) {
        try {
            return JSON.parse(await fs.readFile(file(), 'utf8'));
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT')
                return { state: { snapshots: [] }, version: 0 };
            throw e;
        }
    }
    const { data, error } = await siteDb().from('x_giveaway_state').select('state,version').eq('id', 1).single();
    if (error)
        throw Error('X giveaway storage is not configured.');
    return data as Document;
}
const locks = globalThis as typeof globalThis & {
    xGiveawayWrite?: Promise<void>;
};
export async function saveX(state: XState, version: number) {
    if (localX()) {
        const previous = locks.xGiveawayWrite || Promise.resolve();
        let release!: () => void;
        locks.xGiveawayWrite = new Promise<void>(r => { release = r; });
        await previous;
        try {
            if ((await readX()).version !== version)
                return false;
            await fs.mkdir(path.dirname(file()), { recursive: true });
            const tmp = file() + '.' + randomUUID() + '.tmp';
            await fs.writeFile(tmp, JSON.stringify({ state, version: version + 1 }));
            await fs.rename(tmp, file());
            return true;
        }
        finally {
            release();
        }
    }
    const { data, error } = await siteDb().rpc('x_giveaway_commit', { p_expected: version, p_state: state });
    if (error)
        throw Error('Could not save X giveaway. Retry the same action.');
    return data === true;
}
