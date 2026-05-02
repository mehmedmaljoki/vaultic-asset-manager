import type { SQLiteDatabase } from 'expo-sqlite';
import type { LivePrices } from '../models/PriceMap';
import { TROY_OZ_TO_GRAM } from '../models/PriceMap';
import {
  dbGetPriceCache, dbUpsertPriceCache,
} from '../repositories/PriceCacheRepository';

export type PriceSource = 'live' | 'cache' | 'partial' | 'offline';

export interface PriceFetchResult {
  prices:    Partial<LivePrices>;
  source:    PriceSource;
  fetchedAt: Record<string, string | null>;
}

const PRICE_TTL_MS = 15 * 60 * 1000; // 15 min = max 4 fetches/hour

const GOLD_API_BASE  = 'https://api.gold-api.com/price';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3/simple/price';

const METAL_MAP: Array<{ symbol: string; key: keyof LivePrices }> = [
  { symbol: 'XAU', key: 'gold' },
  { symbol: 'XAG', key: 'silver' },
  { symbol: 'XPT', key: 'platinum' },
  { symbol: 'XPD', key: 'palladium' },
];

const CRYPTO_MAP: Array<{ id: string; key: keyof LivePrices }> = [
  { id: 'bitcoin',     key: 'bitcoin' },
  { id: 'ethereum',    key: 'ethereum' },
  { id: 'solana',      key: 'solana' },
  { id: 'binancecoin', key: 'bnb' },
];

interface GoldApiResponse {
  symbol:   string;
  currency: string;
  price:    number;
  updatedAt?: string;
}

async function fetchOneMetal(
  symbol: string,
  currency: string
): Promise<number | null> {
  try {
    const res = await fetch(`${GOLD_API_BASE}/${symbol}/${currency}`);
    if (!res.ok) return null;
    const data: GoldApiResponse = await res.json();
    if (typeof data.price !== 'number') return null;
    return data.price / TROY_OZ_TO_GRAM;
  } catch {
    return null;
  }
}

async function fetchAllCrypto(
  currency: string
): Promise<Partial<Record<keyof LivePrices, number>>> {
  try {
    const ids = CRYPTO_MAP.map(c => c.id).join(',');
    const res = await fetch(
      `${COINGECKO_BASE}?ids=${ids}&vs_currencies=${currency.toLowerCase()}`
    );
    if (!res.ok) return {};
    const data: Record<string, Record<string, number>> = await res.json();
    const result: Partial<Record<keyof LivePrices, number>> = {};
    for (const { id, key } of CRYPTO_MAP) {
      const price = data[id]?.[currency.toLowerCase()];
      if (typeof price === 'number') result[key] = price;
    }
    return result;
  } catch {
    return {};
  }
}

function isFresh(fetchedAt: string | null | undefined): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() < PRICE_TTL_MS;
}

/**
 * Fetch metal prices from Gold API and crypto prices from CoinGecko, both with 15-min TTL.
 * Rate-limited: max 4 live fetches/hour per source. Returns cached data silently within TTL.
 */
export async function fetchPrices(
  db: SQLiteDatabase,
  currency: string,
  provider: 'goldapi' | 'mock'
): Promise<PriceFetchResult> {
  const { prices: cached, fetchedAt } = await dbGetPriceCache(db, currency);

  if (provider === 'mock') {
    return { prices: cached, source: 'cache', fetchedAt };
  }

  // Check freshness for metals and crypto independently
  const metalKeys      = METAL_MAP.map(m => m.key);
  const cryptoKeys     = CRYPTO_MAP.map(c => c.key);
  const metalsAllFresh = metalKeys.every(k => isFresh(fetchedAt[k]));
  const cryptoAllFresh = cryptoKeys.every(k => isFresh(fetchedAt[k]));
  if (metalsAllFresh && cryptoAllFresh) {
    return { prices: cached, source: 'cache', fetchedAt };
  }

  const now        = new Date().toISOString();
  let liveCount    = 0;
  let failCount    = 0;
  const newPrices  = { ...cached } as Partial<LivePrices>;
  const newFetched = { ...fetchedAt };

  // Fetch stale metals via Gold API (parallel, allSettled so one failure doesn't block others)
  if (!metalsAllFresh) {
    const results = await Promise.allSettled(
      METAL_MAP.map(({ symbol, key }) => {
        if (isFresh(fetchedAt[key])) return Promise.resolve({ key, price: cached[key] ?? null, fresh: false });
        return fetchOneMetal(symbol, currency).then(price => ({ key, price, fresh: true }));
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { key, price, fresh } = result.value;
        if (fresh) {
          if (price != null) {
            (newPrices as Record<string, number>)[key] = price;
            newFetched[key] = now;
            await dbUpsertPriceCache(db, key, currency, price, now);
            liveCount++;
          } else {
            failCount++;
          }
        }
      } else {
        failCount++;
      }
    }
  }

  // Fetch stale crypto via CoinGecko (single batched call for all 4 symbols)
  if (!cryptoAllFresh) {
    const cryptoPrices = await fetchAllCrypto(currency);
    for (const { key } of CRYPTO_MAP) {
      const price = cryptoPrices[key];
      if (price != null) {
        (newPrices as Record<string, number>)[key] = price;
        newFetched[key] = now;
        await dbUpsertPriceCache(db, key, currency, price, now);
      }
    }
  }

  let source: PriceSource;
  if (failCount === 0 && liveCount > 0)      source = 'live';
  else if (liveCount > 0 && failCount > 0)   source = 'partial';
  else if (Object.keys(cached).length > 0)   source = 'offline';
  else                                        source = 'offline';

  return { prices: newPrices, source, fetchedAt: newFetched };
}

/** Returns how many minutes ago the oldest price was fetched, or null. */
export function oldestPriceAgeMinutes(fetchedAt: Record<string, string | null>): number | null {
  const timestamps = Object.values(fetchedAt).filter(Boolean) as string[];
  if (timestamps.length === 0) return null;
  const oldest = Math.min(...timestamps.map(t => new Date(t).getTime()));
  return Math.floor((Date.now() - oldest) / 60_000);
}
