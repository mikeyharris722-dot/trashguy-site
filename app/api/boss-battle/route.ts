import { GET as activeOverlay } from '@/app/api/overlay/route';
import { readBattleTest, updateBattleTest } from '@/lib/boss-battle-local';
export async function GET(request: Request) {
    try {
        if (new URL(request.url).searchParams.get('source') !== 'test')
            return activeOverlay();
        if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_LOCAL_REVIEW !== "1")
            return Response.json({ error: "Local test only" }, { status: 404 });
        return Response.json({ hunt: await readBattleTest() }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch {
        return Response.json({ error: 'Battle could not load' }, { status: 500 });
    }
}
export async function POST(request: Request) {
    if (process.env.NODE_ENV === "production")
        return Response.json({ error: "Local testing only" }, { status: 404 });
    if (process.env.NEXT_PUBLIC_LOCAL_REVIEW !== '1')
        return Response.json({ error: 'Not available' }, { status: 404 });
    if (request.headers.get('origin') !== new URL(request.url).origin)
        return Response.json({ error: 'Invalid origin' }, { status: 403 });
    try {
        return Response.json({ hunt: await updateBattleTest(await request.json()) });
    }
    catch (e) {
        return Response.json({ error: e instanceof Error ? e.message : 'Could not save' }, { status: 400 });
    }
}
