import type { SQLiteDatabase } from 'expo-sqlite';
import { dbGetFxCache, dbUpsertFxRate } from '../repositories/FxCacheRepository';

export type FxSource = 'live' | 'cache' | 'offline';

export interface FxFetchResult {
  rates:     Record<string, number>;          // currency → multiplier; rates[base] = 1
  source:    FxSource;
  fetchedAt: Record<string, string | null>;
}

const FX_TTL_MS  = 24 * 60 * 60 * 1000;       // 24h — currencies move slowly enough
const FX_API     = 'https://api.exchangerate-api.com/v4/latest';

interface FxApiResponse {
  base:  string;
  date:  string;
  rates: Record<string, number>;              // base→other; we invert to get other→base
}

function isFresh(fetchedAt: string | null | undefined): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() < FX_TTL_MS;
}

async function fetchLatest(base: string): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`${FX_API}/${base}`);
    if (!res.ok) return null;
    const data: FxApiResponse = await res.json();
    if (!data.rates || typeof data.rates !== 'object') return null;
    return data.rates;
  } catch {
    return null;
  }
}

/**
 * Fetch FX rates with the given base, cached for 24h. Returns cached values
 * silently within TTL and falls back to cache (source=offline) on network failure.
 *
 * Result `rates[currency]` is the multiplier to convert an amount in `currency`
 * into `base`: `amount * rates[currency] = amount in base`.
 */
export async function fetchFxRates(
  db: SQLiteDatabase,
  base: string
): Promise<FxFetchResult> {
  const { rates: cached, fetchedAt } = await dbGetFxCache(db, base);

  const cachedKeys     = Object.keys(cached);
  const someFresh      = cachedKeys.length > 0 && cachedKeys.every(k => isFresh(fetchedAt[k]));
  if (someFresh) {
    return { rates: { ...cached, [base]: 1 }, source: 'cache', fetchedAt };
  }

  const live = await fetchLatest(base);
  if (live == null) {
    // Network failed — return whatever we have cached (may be empty).
    return {
      rates:     { ...cached, [base]: 1 },
      source:    'offline',
      fetchedAt,
    };
  }

  const now            = new Date().toISOString();
  const rates:     Record<string, number>         = { [base]: 1 };
  const fetchedAtNew: Record<string, string | null> = { ...fetchedAt };
  for (const [currency, baseToOther] of Object.entries(live)) {
    if (typeof baseToOther !== 'number' || baseToOther <= 0) continue;
    const otherToBase = 1 / baseToOther;
    rates[currency]      = otherToBase;
    fetchedAtNew[currency] = now;
    await dbUpsertFxRate(db, base, currency, otherToBase, now);
  }

  return { rates, source: 'live', fetchedAt: fetchedAtNew };
}
