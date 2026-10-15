"use client";
import {huntCurrencies,type HuntCurrency} from '@/lib/hunt-currency';
export default function HuntCurrencySelect({value,onChange}:{value:HuntCurrency;onChange:(value:HuntCurrency)=>void}){return <label className="hunt-currency-choice">Hunt currency<select aria-label="Hunt currency" value={value} onChange={e=>onChange(e.target.value as HuntCurrency)}>{huntCurrencies.map(code=><option key={code} value={code}>{code} · {{USD:'US dollar',CAD:'Canadian dollar',ARS:'Argentine peso',GBP:'British pound'}[code]}</option>)}</select></label>;}
