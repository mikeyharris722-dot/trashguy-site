import { money } from './tracker-math';
import { huntCurrency } from './hunt-currency';

// Community contributions are USD; this fixed rate is hunt units per USD.
export function communityEquityRate(currency: unknown, value: unknown): string {
  if (huntCurrency(currency) === 'USD') return '1';
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d{1,6})?$/.test(text) || money(text) <= BigInt('0') || money(text) > BigInt('1000000000000'))
    throw Error('Enter a positive exchange rate: hunt currency per 1 USD (up to six decimal places).');
  return text;
}
export function communityBankroll(usd: bigint, rate: string): bigint {
  // Convert the total once, rounding half up to hunt-currency cents.
  return ((usd * money(rate) + BigInt('5000000000')) / BigInt('10000000000')) * BigInt('10000');
}
