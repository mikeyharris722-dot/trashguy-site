import type {PrizeSettings} from './prize-settings';
export type LeaderboardPeriod={start:string;end:string;prizes:number[]|null};
export function leaderboardPeriods(settings:PrizeSettings,now=Date.now()):LeaderboardPeriod[]{
 const periods:LeaderboardPeriod[]=[];
 for(let year=2026,month=8;Date.UTC(year,month,5)<=now;month++){if(month===12){year++;month=0;}const start=new Date(Date.UTC(year,month,5)).toISOString().slice(0,10),end=new Date(Date.UTC(year,month+1,5)).toISOString().slice(0,10);if(Date.parse(start)>now)break;const saved=settings.leaderboardArchives?.find(p=>p.start===start&&p.end===end);periods.push({start,end,prizes:saved?.prizes||null});}
 const active={start:settings.leaderboardStart,end:settings.leaderboardEnd,prizes:settings.leaderboard};
 const result=periods.filter(p=>p.start!==active.start);result.push(active);
 for(const saved of settings.leaderboardArchives||[])if(!result.some(p=>p.start===saved.start))result.push(saved);
 return result.sort((a,b)=>b.start.localeCompare(a.start));
}
export function affiliateStandings(rows:Record<string,unknown>[]){
 const players=rows.map((p,index)=>{const total=Number(p.wagered_amount??p.wageredAmount??p.total_wagered??p.totalWagered),weighted=Number(p.weighted_wagered_amount??p.weightedWageredAmount??p.weighted_wagered);if(!Number.isFinite(total)||!Number.isFinite(weighted)||total<0||weighted<0)throw Error('The provider returned incomplete wager data.');return {username:String(p.username||p.name||p.display_name||'Player '+(index+1)),wagered:weighted,totalWagered:total,badges:p.badges||[],rank:0};}).sort((a,b)=>b.wagered-a.wagered||a.username.localeCompare(b.username)).map((p,index)=>({...p,rank:index+1}));
 const cents=(key:'wagered'|'totalWagered')=>players.reduce((n,p)=>n+Math.round(p[key]*100),0)/100;
 return {players,totals:{affiliates:players.length,totalWagered:cents('totalWagered'),weightedWagered:cents('wagered')}};
}
