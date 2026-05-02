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

const GOLD_API_BASE = 'https://api.gold-api.com/price';

const METAL_MAP: Array<{ symbol: string; key: keyof LivePrices }> = [
  { symbol: 'XAU', key: 'gold' },
  { symbol: 'XAG', key: 'silver' },
  { symbol: 'XPT', key: 'platinum' },
  { symbol: 'XPD', key: 'palladium' },
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

function isFresh(fetchedAt: string | null | undefined): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() < PRICE_TTL_MS;
}

/**
 * Fetch metal prices from Gold API with 15-min TTL cache.
 * Rate-limited: max 4 live fetches per hour regardless of how many times called.
 * Returns cached data silently if within TTL — even when called via manual refresh.
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

  // Check if all metal keys are fresh — if so, no network call needed
  const metalKeys = METAL_MAP.map(m => m.key);
  const allFresh  = metalKeys.every(k => isFresh(fetchedAt[k]));
  if (allFresh) {
    return { prices: cached, source: 'cache', fetchedAt };
  }

  // Attempt live fetch for stale/missing symbols only
  const results = await Promise.allSettled(
    METAL_MAP.map(({ symbol, key }) => {
      if (isFresh(fetchedAt[key])) return Promise.resolve({ key, price: cached[key] ?? null, fresh: false });
      return fetchOneMetal(symbol, currency).then(price => ({ key, price, fresh: true }));
    })
  );

  const now        = new Date().toISOString();
  let liveCount    = 0;
  let failCount    = 0;
  const newPrices  = { ...cached } as Partial<LivePrices>;
  const newFetched = { ...fetchedAt };

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

  let source: PriceSource;
  if (failCount === 0 && liveCount > 0)      source = 'live';
  else if (liveCount > 0 && failCount > 0)   source = 'partial';
  else if (Object.keys(cached).length > 0)   source = 'offline';
  else                                        source = 'offline';

  return { prices: newPrices, source, fetchedAt: newFetched };
}

/** Returns how many minutes ago the oldest metal price was fetched, or null. */
export function oldestPriceAgeMinutes(fetchedAt: Record<string, string | null>): number | null {
  const timestamps = Object.values(fetchedAt).filter(Boolean) as string[];
  if (timestamps.length === 0) return null;
  const oldest = Math.min(...timestamps.map(t => new Date(t).getTime()));
  return Math.floor((Date.now() - oldest) / 60_000);
}
