import { huntMoney } from '@/lib/hunt-currency';

export type CommunityBonus = {
  id: string;
  slotName: string;
  betSize: number;
  payout: number | null;
  multiplier: number;
  note?: string | null;
};
export default function CommunityBonusList({bonuses=[],currency='USD'}:{bonuses?:CommunityBonus[];currency?:string}) {
  return <section className="min-w-0" aria-label="Community hunt slots">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-black uppercase tracking-wide text-purple-200 sm:text-sm">Slots in this Hunt</h2>
      <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-xs font-bold">{bonuses.length} {bonuses.length===1?"Slot":"Slots"}</span>
    </div>
    {!bonuses.length ? <p className="empty-state">No bonuses collected in this hunt yet. Successful slot calls appear here once they are added to the tracker.</p> :
      <div className="max-h-[340px] space-y-2 overflow-y-auto sm:max-h-[480px]">
        {bonuses.map((bonus,index)=><div key={bonus.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-purple-300/10 bg-black/25 px-3 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-purple-300/20 bg-purple-400/10 text-xs font-bold text-purple-200">{index+1}</span>
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-xs font-bold sm:text-sm">{bonus.slotName}</h3>
            {bonus.note && <p className="break-words text-[10px] text-white/50 sm:text-xs">Called by {bonus.note}</p>}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] sm:text-xs">
              <span className="text-white/60">Bet {huntMoney(bonus.betSize,currency)}</span>
              <span className="text-white/75">{bonus.payout === null ? 'Awaiting opening' : `${bonus.multiplier.toFixed(2)}×`}</span>
              <strong className="text-purple-200">{bonus.payout === null ? '—' : huntMoney(bonus.payout,currency)}</strong>
            </div>
          </div>
        </div>)}
      </div>}
  </section>;
}
