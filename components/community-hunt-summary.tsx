import { huntMoney } from '@/lib/hunt-currency';
import type { CommunityBonus } from './community-bonus-list';

export type CommunitySummaryHunt = {
  title?: string; currency?: string; casino?: string; phase?: string; startCost?: number;
  prediction_status: string;
  stats: {totalWinnings:number;currentAverageMultiplier?:number;averagePayoutRequired?:number|null;profitLoss?:number};
  bonuses?: CommunityBonus[];
};
export default function CommunityHuntSummary({hunt}:{hunt:CommunitySummaryHunt}) {
  const bonuses=hunt.bonuses||[],opened=bonuses.filter(b=>b.payout!==null);
  const highestWin=opened.reduce<CommunityBonus|null>((best,b)=>!best||Number(b.payout)>Number(best.payout)?b:best,null);
  const highestX=opened.reduce<CommunityBonus|null>((best,b)=>!best||b.multiplier>best.multiplier?b:best,null);
  const average=hunt.stats.currentAverageMultiplier ?? (opened.length?opened.reduce((sum,b)=>sum+b.multiplier,0)/opened.length:0);
  const required=hunt.stats.averagePayoutRequired;
  const money=(value:number)=>huntMoney(value,hunt.currency||'USD');
  const smallLabel='text-[6px] font-black uppercase tracking-[0.10em] text-white/35 sm:text-[9px]';
  const card='min-w-0 rounded-xl border border-purple-300/10 bg-black/25 p-2.5 sm:p-4';
  return <div className="min-w-0 border-b border-purple-300/10 p-3 sm:p-5 lg:border-b-0 lg:border-r" aria-label="Community hunt summary">
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2 className="min-w-0 break-words text-[13px] font-black text-white sm:text-[21px]">{hunt.title||'Community Hunt'}</h2>
      <span className={'shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase sm:px-4 sm:py-2 sm:text-[11px] '+(hunt.prediction_status==='open'?'border-purple-300/25 bg-purple-400/10 text-purple-100':'border-red-300/25 bg-red-400/10 text-red-200')}>{hunt.prediction_status==='open'?'Open':'Closed'}</span>
    </div>
    <p className="mt-1 text-[8px] text-white/45 sm:text-[11px]">Community · {hunt.casino||'Rainbet'} · {hunt.currency||'USD'} · {hunt.phase==='finished'?'Finished':hunt.phase==='opening'?'Opening bonuses':'Collecting bonuses'}</p>
    <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className={card}><p className={smallLabel}>Start</p><p className="mt-1 break-words text-[17px] font-black tracking-tight sm:text-[28px]">{money(hunt.startCost||0)}</p></div>
        <div className={card+' border-purple-300/20 bg-purple-400/5'}><p className={smallLabel}>Won</p><p className="mt-1 break-words text-[17px] font-black tracking-tight text-purple-200 sm:text-[28px]">{money(hunt.stats.totalWinnings)}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[['Bonuses',String(bonuses.length)],['Avg X',`${average.toFixed(2)}x`],['Req X',required==null?'—':`${required.toFixed(2)}x`]].map(([label,value])=><div key={label} className="min-w-0 rounded-xl border border-purple-300/10 bg-black/25 p-2"><p className={smallLabel}>{label}</p><p className="mt-1 break-words text-[14px] font-black sm:text-[20px]">{value}</p></div>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={card}><p className={smallLabel}>Highest Win</p><p className="mt-1.5 truncate text-[10px] font-black sm:mt-2 sm:text-[14px]" title={highestWin?.slotName}>{highestWin?.slotName||'—'}</p><p className="mt-1 break-words text-[14px] font-black text-purple-200 sm:text-[20px]">{highestWin?money(Number(highestWin.payout)):'—'}</p></div>
        <div className={card}><p className={smallLabel}>Highest X</p><p className="mt-1.5 truncate text-[10px] font-black sm:mt-2 sm:text-[14px]" title={highestX?.slotName}>{highestX?.slotName||'—'}</p><p className="mt-1 text-[14px] font-black text-purple-200 sm:text-[20px]">{highestX?`${highestX.multiplier.toFixed(2)}x`:'—'}</p></div>
      </div>
    </div>
  </div>;
}
