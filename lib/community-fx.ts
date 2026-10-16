import 'server-only';
import { huntCurrency } from './hunt-currency';
import { communityEquityRate } from './community-equity';

type Quote = { equityRate: string; equityRateDate: string; equityRateSource: string };
type RateData = { rates: Record<string, number>; updated: number };
const key = Symbol.for('trashguy.community.usd-rates');
const shared = globalThis as typeof globalThis & { [key]?: { expires: number; pending: Promise<RateData> } };
const unavailable = () => Error('The latest exchange rate is unavailable. No changes were saved. Please retry shortly.');
async function latestRates(): Promise<RateData> {
  if (shared[key] && shared[key].expires > Date.now()) return shared[key].pending;
  const pending = (async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD', {
        next: { revalidate: 3600 }, signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw unavailable();
      const data = await response.json();
      const updated = Number(data.time_last_update_unix) * 1000;
      if (data.result !== 'success' || data.base_code !== 'USD' || !Number.isFinite(updated) ||
        updated > Date.now() || Date.now() - updated > 3 * 86400000 || !data.rates)
        throw unavailable();
      return { rates: data.rates, updated };
    } catch { throw unavailable(); }
  })();
  shared[key] = { expires: Date.now() + 3600000, pending };
  try { return await pending; } catch (error) {
    if (shared[key]?.pending === pending) delete shared[key];
    throw error;
  }
}
export async function communityFx(code: unknown): Promise<Quote> {
  const currency = huntCurrency(code);
  if (currency === 'USD') return { equityRate: '1', equityRateDate: new Date().toISOString().slice(0,10), equityRateSource: 'USD' };
  const data = await latestRates();
  if (Date.now() - data.updated > 3 * 86400000 || data.updated > Date.now()) throw unavailable();
  const value = data.rates[currency];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1000000) throw unavailable();
  return {
    equityRate: communityEquityRate(currency, value.toFixed(6)),
    equityRateDate: new Date(data.updated).toISOString().slice(0,10),
    equityRateSource: 'ExchangeRate-API',
  };
}
