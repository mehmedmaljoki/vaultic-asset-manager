import { TROY_OZ_TO_GRAM } from '../models/PriceMap';
import type { LivePrices } from '../models/PriceMap';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3/coins';

/** Price keys we can backfill from CoinGecko, mapped to their CoinGecko coin id.
 *  Gold uses PAXG (1:1 LBMA-gold-backed token, ~0.04% off spot). Silver/platinum/
 *  palladium have no clean no-key EUR history → excluded (valued at today's price). */
export const COINGECKO_HISTORY_IDS: Partial<Record<keyof LivePrices, string>> = {
  gold:     'pax-gold',
  bitcoin:  'bitcoin',
  ethereum: 'ethereum',
  solana:   'solana',
  bnb:      'binancecoin',
};

interface MarketChartResponse { prices?: number[][]; }

/** Parse a market_chart response into { 'YYYY-MM-DD': price } (last sample per day wins). */
export function parseMarketChart(raw: MarketChartResponse): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || !Array.isArray(raw.prices)) return out;
  for (const entry of raw.prices) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [ms, price] = entry;
    if (typeof ms !== 'number' || typeof price !== 'number') continue;
    out[new Date(ms).toISOString().slice(0, 10)] = price;
  }
  return out;
}

/** Fetch daily history for one price key in `currency`. Gold is converted to per-gram
 *  to match the app's live metal convention. Returns {} on any failure (offline-safe). */
export async function fetchHistory(
  key: keyof LivePrices,
  currency: string,
  days: number,
  fetchFn: typeof fetch = fetch,
): Promise<Record<string, number>> {
  const id = COINGECKO_HISTORY_IDS[key];
  if (!id) return {};
  try {
    const url = `${COINGECKO_BASE}/${id}/market_chart?vs_currency=${currency.toLowerCase()}&days=${days}&interval=daily`;
    const res = await fetchFn(url);
    if (!res.ok) return {};
    const raw = (await res.json()) as MarketChartResponse;
    const map = parseMarketChart(raw);
    if (key === 'gold') {
      // PAXG is priced per troy ounce; app stores metals per gram.
      for (const d of Object.keys(map)) map[d] = map[d] / TROY_OZ_TO_GRAM;
    }
    return map;
  } catch {
    return {};
  }
}
