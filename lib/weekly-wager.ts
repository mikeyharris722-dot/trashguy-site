export type WeeklyTarget={id:string;target:number;reward:number};
export type WeeklyWagerSettings={enabled:boolean;start:string;end:string;targets:WeeklyTarget[]};
export const defaultWeeklyWager:WeeklyWagerSettings={enabled:false,start:'2026-10-12',end:'2026-10-19',targets:[{id:'target-1',target:5000,reward:10}]};
export function validateWeeklyWager(value:unknown):WeeklyWagerSettings{
 const v=value as WeeklyWagerSettings;if(!v||typeof v.enabled!=='boolean')throw Error('Set weekly rewards activation to on or off.');
 const date=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 if(!date(v.start)||!date(v.end)||v.end<=v.start)throw Error('Choose valid weekly reward dates, with end after start.');
 if(!Array.isArray(v.targets)||!v.targets.length||v.targets.length>10)throw Error('Configure between one and ten weekly targets.');
 const money=(n:number)=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1000000&&Math.abs(n*100-Math.round(n*100))<0.00001;
 const ids=new Set<string>();const targets=v.targets.map(t=>{if(!t||!/^[a-z0-9-]{1,40}$/.test(t.id)||ids.has(t.id)||!money(t.target)||!money(t.reward))throw Error('Enter unique weekly targets and positive amounts with up to two decimal places.');ids.add(t.id);return {id:t.id,target:t.target,reward:t.reward};});
 if(targets.some((t,i)=>i>0&&t.target<=targets[i-1].target))throw Error('Weekly wager targets must increase.');
 return {enabled:v.enabled,start:v.start,end:v.end,targets};
}
export function weeklyProgress(weighted:number,target:number){if(!Number.isFinite(weighted)||weighted<0)throw Error('Invalid weighted wager.');return {percentage:Math.min(100,weighted/target*100),remaining:Math.max(0,target-weighted),eligible:Math.round(weighted*100)>=Math.round(target*100)};}

/** The displayed end date is inclusive; the provider receives the next UTC midnight. */
export function weeklyEndExclusive(end:string){return new Date(Date.parse(end+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
