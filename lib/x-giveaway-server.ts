import 'server-only';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { readX, saveX } from './x-giveaway-store';
import { eligibleEntries, postInfo, username, type XEntry, type XSnapshot } from './x-giveaway';
type Command = {
    action: string;
    requestId?: string;
    snapshotId?: string;
    postUrl?: string;
    author?: string;
    excluded?: string[];
    entries?: XEntry[];
    collectionId?: string;
};
export async function xCommand(actor: string, body: Command): Promise<XSnapshot> {
    if (!actor)
        throw Error('AUTH: Admin required.');
    if (!['snapshot', 'draw'].includes(body.action))
        throw Error('Unknown X giveaway action.');
    if (body.action === 'snapshot' && !/^[0-9a-f-]{36}$/i.test(body.requestId || ''))
        throw Error('Invalid request ID.');
    const fingerprint = createHash('sha256').update(JSON.stringify([body.postUrl || '', body.author || '', body.excluded || [], body.entries || [],body.collectionId||''])).digest('hex');
    for (let attempt = 0; attempt < 8; attempt++) {
        const { state, version } = await readX();
        let snapshot: XSnapshot;
        if (body.action === 'snapshot') {
            const prior = state.snapshots.find(s => s.requestId === body.requestId);
            if (prior) {
                if (prior.createdBy !== actor || prior.fingerprint !== fingerprint)
                    throw Error('Request ID already used.');
                return prior;
            }
            const info = postInfo(String(body.postUrl || '')), author = info.author || (body.author ? username(body.author) : '');
            const excluded = (body.excluded || []).map(username);
            const { entries } = eligibleEntries(body.entries || [], author, excluded);
            if(body.collectionId){const collection=state.collections?.find(c=>c.id===body.collectionId);if(!collection||collection.status!=='succeeded'||collection.postUrl!==info.postUrl)throw Error('Invalid reply collection.');}
            snapshot = { id: randomUUID(), requestId: body.requestId!, fingerprint, postUrl: info.postUrl, author, excluded, entries, createdAt: new Date().toISOString(), createdBy: actor, ...(body.collectionId?{collectionId:body.collectionId}:{}) };
            if(body.collectionId){const collection=state.collections?.find(c=>c.id===body.collectionId);if(collection?.partial)snapshot.collectionWarning=collection.message||'Partial results — some replies may be missing.';}
            state.snapshots.push(snapshot);
        }
        else {
            const found = state.snapshots.find(s => s.id === body.snapshotId);
            if (!found)
                throw Error('Snapshot not found.');
            snapshot = found;
            // Exactly one draw per frozen snapshot, even across clients or retries.
            if (snapshot.draw)
                return snapshot;
            if(snapshot.collectionId&&state.collections?.find(c=>c.id===snapshot.collectionId)?.limited)throw Error('Reply limit reached. Import a complete list before drawing.');
            if (!snapshot.entries.length) throw Error('Add at least one eligible account before spinning.');
            const index = randomInt(snapshot.entries.length);
            snapshot.draw = { index, winner: snapshot.entries[index], createdAt: new Date().toISOString() };
        }
        if (await saveX(state, version))
            return snapshot;
    }
    throw Error('Giveaway is busy. Retry the same action.');
}
