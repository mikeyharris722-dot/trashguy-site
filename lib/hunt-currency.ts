export const huntCurrencies=['USD','CAD','ARS','GBP'] as const;
export type HuntCurrency=typeof huntCurrencies[number];
export function huntCurrency(value:unknown):HuntCurrency{if(value===undefined||value===null)return 'USD';if(!huntCurrencies.includes(value as HuntCurrency))throw Error('Choose USD, CAD, ARS or GBP.');return value as HuntCurrency;}
export function huntMoney(value:number,currency:string='USD',compact=false){return new Intl.NumberFormat('en-US',{style:'currency',currency:huntCurrency(currency),currencyDisplay:compact?'narrowSymbol':'code',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}
