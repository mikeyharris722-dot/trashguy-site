import BossBattlePreview from '@/components/boss-battle-preview';
export default async function Overlay({ searchParams }: {
    searchParams: Promise<{
        source?: string;
    }>;
}) {
    const params = await searchParams;
    return <BossBattlePreview overlayOnly initialSource={params.source === 'test' && process.env.NEXT_PUBLIC_LOCAL_REVIEW === '1' ? 'test' : 'active'}/>;
}
