/** Monthly rewards launch with the next leaderboard; earlier periods never qualify. */
export const MONTHLY_REWARDS_FIRST_PERIOD = '2026-11-05';
export type WeeklyTarget={id:string;target:number;reward:number};
export type WeeklyWagerSettings={enabled:boolean;periodMode?:'leaderboard';start:string;end:string;targets:WeeklyTarget[]};
export const defaultWeeklyWager:WeeklyWagerSettings={enabled:false,start:'2026-10-12',end:'2026-10-19',periodMode:'leaderboard',targets:[{id:'monthly-5k',target:5000,reward:10},{id:'monthly-10k',target:10000,reward:15},{id:'monthly-15k',target:15000,reward:20},{id:'monthly-25k',target:25000,reward:30},{id:'monthly-50k',target:50000,reward:40},{id:'monthly-75k',target:75000,reward:50},{id:'monthly-100k',target:100000,reward:60}]};
export function validateWeeklyWager(value:unknown):WeeklyWagerSettings{
 const v=value as WeeklyWagerSettings;if(!v||typeof v.enabled!=='boolean')throw Error('Set monthly rewards activation to on or off.');
 const date=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!date(v.start)||!date(v.end)||v.end<=v.start)throw Error('Choose valid monthly reward dates, with end after start.');
 if(!Array.isArray(v.targets)||!v.targets.length||v.targets.length>10)throw Error('Configure between one and ten monthly targets.');
 const money=(n:number)=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1000000&&Math.abs(n*100-Math.round(n*100))<0.00001;
 const ids=new Set<string>();const targets=v.targets.map(t=>{if(!t||!/^[a-z0-9-]{1,40}$/.test(t.id)||ids.has(t.id)||!money(t.target)||!money(t.reward))throw Error('Enter unique monthly targets and positive amounts with up to two decimal places.');ids.add(t.id);return {id:t.id,target:t.target,reward:t.reward};});
 if(targets.some((t,i)=>i>0&&t.target<=targets[i-1].target))throw Error('Monthly wager targets must increase.');
 return {enabled:v.enabled,...(v.periodMode==='leaderboard'?{periodMode:'leaderboard' as const}:{}),start:v.start,end:v.end,targets};
}
export function weeklyProgress(weighted:number,target:number){if(!Number.isFinite(weighted)||weighted<0)throw Error('Invalid weighted wager.');return {percentage:Math.min(100,weighted/target*100),remaining:Math.max(0,target-weighted),eligible:Math.round(weighted*100)>=Math.round(target*100)};}

/** The displayed end date is inclusive; the provider receives the next UTC midnight. */
export function weeklyEndExclusive(end:string){return new Date(Date.parse(end+'T00:00:00Z')+86400000).toISOString().slice(0,10);}

/** Leaderboard end is exclusive; reward displays retain the inclusive date contract. */
export function leaderboardRewards(config:WeeklyWagerSettings|undefined,start:string,end:string):WeeklyWagerSettings {
 const base=config?.periodMode==='leaderboard'?config:{...defaultWeeklyWager,enabled:false};
 return {...base,periodMode:'leaderboard',start,end:new Date(Date.parse(end+'T00:00:00Z')-86400000).toISOString().slice(0,10)};
}
