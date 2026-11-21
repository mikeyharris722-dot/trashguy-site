import { requireTrackerAdmin, apiError } from '@/lib/site-db';
import { readX } from '@/lib/x-giveaway-store';
import {startCollection,pollCollection} from '@/lib/x-collection';
import { xCommand } from '@/lib/x-giveaway-server';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) { try {
    await requireTrackerAdmin(request);
    return Response.json((await readX()).state, { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (e) {
    return apiError(e);
} }
export async function POST(request: Request) { try {
    const actor = await requireTrackerAdmin(request);
    const text = await request.text();
    if (text.length > 2000000)
        throw Error('Request too large.');
    const body=JSON.parse(text);
    const result=body.action==='fetch' ? await startCollection(String(body.postUrl||'')) : body.action==='fetchStatus' ? await pollCollection(String(body.id||'')) : await xCommand(actor,body);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
}
catch (e) {
    return apiError(e);
} }
