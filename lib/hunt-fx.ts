import 'server-only';
import {huntCurrency} from './hunt-currency';
export type PayoutFx={currency:string;rate:number;date:string;source:string};
const key=Symbol.for('trashguy.hunt.fx'),cache=globalThis as typeof globalThis&{[key]?:Map<string,Promise<PayoutFx>>};
export async function payoutFx(code:unknown):Promise<PayoutFx>{const currency=huntCurrency(code),day=new Date().toISOString().slice(0,10);if(currency==='USD')return {currency,rate:1,date:day,source:'USD'};
const rates=cache[key]??=new Map(),id=currency+':'+day;const old=rates.get(id);
const pending=old||(async()=>{const response=await fetch('https://api.frankfurter.dev/v2/rate/'+currency.toLowerCase()+'/usd',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Exchange rate unavailable. The payout was not saved; please retry.');const data=await response.json();const rate=Number(data.rate),date=String(data.date||'');if(data.base!==currency||data.quote!=='USD'||!Number.isFinite(rate)||rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||Date.parse(date+'T00:00:00Z')>Date.now()||Date.now()-Date.parse(date+'T00:00:00Z')>7*86400000)throw Error('A current exchange rate is unavailable. Please retry before saving.');return {currency,rate,date,source:'Frankfurter'};})();rates.set(id,pending);try{return await pending;}catch(error){if(rates.get(id)===pending)rates.delete(id);
// The configured fallback is CAD per USD; payouts store the inverse (USD per CAD).
// Do not cache a failed lookup for the day: the next payout can use a recovered live rate.
if(currency==='CAD')return {currency,rate:1/1.41,date:day,source:'Configured CAD fallback: 1 USD = 1.41 CAD'};
throw error;}}
