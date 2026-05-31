import { fetchPrices } from '../../../lib/services/PriceService';
import { TROY_OZ_TO_GRAM } from '../../../lib/models/PriceMap';

// ── Mock fetch globally ───────────────────────────────────────────────────────
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

// ── Mock PriceCacheRepository ─────────────────────────────────────────────────
const mockGetCache  = jest.fn();
const mockUpsert    = jest.fn();
jest.mock('../../../lib/repositories/PriceCacheRepository', () => ({
  dbGetPriceCache:   (...a: unknown[]) => mockGetCache(...a),
  dbUpsertPriceCache: (...a: unknown[]) => mockUpsert(...a),
}));

const db = {} as import('expo-sqlite').SQLiteDatabase;

const FRESH_AT    = new Date(Date.now() - 2 * 60 * 1000).toISOString();  // 2 min ago
const STALE_AT    = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 min ago
const CACHED_PRICES = { gold: 126.0, silver: 1.0, platinum: 30.0, palladium: 35.0 };

const ALL_FRESH_AT = {
  gold: FRESH_AT, silver: FRESH_AT, platinum: FRESH_AT, palladium: FRESH_AT,
  bitcoin: FRESH_AT, ethereum: FRESH_AT, solana: FRESH_AT, bnb: FRESH_AT,
};

function makeGoldApiResponse(symbol: string, pricePerOz: number) {
  return { ok: true, json: async () => ({ symbol, price: pricePerOz, currency: 'EUR' }) };
}

function makeCoinGeckoResponse(currency: string, prices: Record<string, number>) {
  const cur = currency.toLowerCase();
  return {
    ok: true,
    json: async () => ({
      bitcoin:     { [cur]: prices.bitcoin     ?? 80000 },
      ethereum:    { [cur]: prices.ethereum    ?? 2000  },
      solana:      { [cur]: prices.solana      ?? 130   },
      binancecoin: { [cur]: prices.bnb         ?? 500   },
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue(undefined);
});

describe('fetchPrices — goldapi provider, cache fresh', () => {
  it('skips network call when all metal AND crypto prices are within 15-min TTL', async () => {
    mockGetCache.mockResolvedValue({ prices: CACHED_PRICES, fetchedAt: ALL_FRESH_AT });
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('cache');
  });

  it('returns cache even when called via manual refresh within TTL', async () => {
    mockGetCache.mockResolvedValue({ prices: CACHED_PRICES, fetchedAt: ALL_FRESH_AT });
    // Call twice (simulating user tapping refresh)
    await fetchPrices(db, 'EUR', 'goldapi');
    await fetchPrices(db, 'EUR', 'goldapi');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('fetchPrices — goldapi provider, cache stale', () => {
  it('fetches live metal prices and converts troy oz to grams', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    const pricePerOz = 3936.0;
    // 4 metal fetches + 1 CoinGecko batch fetch
    mockFetch
      .mockResolvedValueOnce(makeGoldApiResponse('XAU', pricePerOz))
      .mockResolvedValueOnce(makeGoldApiResponse('XAG', pricePerOz))
      .mockResolvedValueOnce(makeGoldApiResponse('XPT', pricePerOz))
      .mockResolvedValueOnce(makeGoldApiResponse('XPD', pricePerOz))
      .mockResolvedValueOnce(makeCoinGeckoResponse('EUR', {}));

    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(mockFetch).toHaveBeenCalledTimes(5); // XAU, XAG, XPT, XPD + CoinGecko batch
    expect(result.prices.gold).toBeCloseTo(pricePerOz / TROY_OZ_TO_GRAM);
  });

  it('stores fetched prices in cache', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    mockFetch.mockResolvedValue(makeGoldApiResponse('XAU', 3936.0));
    await fetchPrices(db, 'EUR', 'goldapi');
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('returns source=live when all metal fetches succeed', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    mockFetch.mockResolvedValue(makeGoldApiResponse('XAU', 3936.0));
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(result.source).toBe('live');
  });
});

describe('fetchPrices — network error handling', () => {
  it('returns stale cache when all metal fetches fail', async () => {
    mockGetCache.mockResolvedValue({
      prices: CACHED_PRICES,
      fetchedAt: { gold: STALE_AT, silver: STALE_AT, platinum: STALE_AT, palladium: STALE_AT },
    });
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(result.source).toBe('offline');
    expect(result.prices.gold).toBe(CACHED_PRICES.gold);
  });

  it('returns offline with empty prices when no cache and no network', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(result.source).toBe('offline');
    expect(Object.keys(result.prices)).toHaveLength(0);
  });

  it('returns partial when some metal fetches succeed and some fail', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    mockFetch
      .mockResolvedValueOnce(makeGoldApiResponse('XAU', 3936.0)) // gold ok
      .mockRejectedValue(new Error('fail'));                       // rest fail
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(result.source).toBe('partial');
    expect(result.prices.gold).toBeDefined();
    expect(result.prices.silver).toBeUndefined();
  });

  it('one metal symbol failing does not block the others (allSettled)', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    mockFetch
      .mockResolvedValueOnce(makeGoldApiResponse('XAU', 3936.0))
      .mockResolvedValueOnce(makeGoldApiResponse('XAG', 32.0))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeGoldApiResponse('XPD', 1200.0))
      .mockResolvedValueOnce(makeCoinGeckoResponse('EUR', {})); // CoinGecko batch
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(result.prices.gold).toBeDefined();
    expect(result.prices.silver).toBeDefined();
    expect(result.prices.platinum).toBeUndefined();
    expect(result.prices.palladium).toBeDefined();
  });
});

describe('fetchPrices — crypto pricing via CoinGecko', () => {
  it('fetches crypto prices when stale and upserts each to cache', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    // 4 metal fetches return ok, 5th is CoinGecko batch
    mockFetch
      .mockResolvedValueOnce(makeGoldApiResponse('XAU', 3936.0))
      .mockResolvedValueOnce(makeGoldApiResponse('XAG', 32.0))
      .mockResolvedValueOnce(makeGoldApiResponse('XPT', 950.0))
      .mockResolvedValueOnce(makeGoldApiResponse('XPD', 1200.0))
      .mockResolvedValueOnce(makeCoinGeckoResponse('EUR', { bitcoin: 85000, ethereum: 2000, solana: 130, bnb: 500 }));

    const result = await fetchPrices(db, 'EUR', 'goldapi');

    expect(result.prices.bitcoin).toBe(85000);
    expect(result.prices.ethereum).toBe(2000);
    expect(result.prices.solana).toBe(130);
    expect(result.prices.bnb).toBe(500);
    // upsert called for 4 metals + 4 cryptos = 8 times
    expect(mockUpsert).toHaveBeenCalledTimes(8);
  });

  it('skips CoinGecko call when all crypto prices are fresh', async () => {
    // Metals stale, crypto fresh — only metal fetches should happen
    mockGetCache.mockResolvedValue({
      prices: { ...CACHED_PRICES, bitcoin: 85000, ethereum: 2000, solana: 130, bnb: 500 },
      fetchedAt: {
        gold: STALE_AT, silver: STALE_AT, platinum: STALE_AT, palladium: STALE_AT,
        bitcoin: FRESH_AT, ethereum: FRESH_AT, solana: FRESH_AT, bnb: FRESH_AT,
      },
    });
    mockFetch.mockResolvedValue(makeGoldApiResponse('XAU', 3936.0));

    await fetchPrices(db, 'EUR', 'goldapi');

    // Only 4 metal calls — no CoinGecko call
    expect(mockFetch).toHaveBeenCalledTimes(4);
    const urls: string[] = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(urls.every(u => u.includes('gold-api.com'))).toBe(true);
  });
});
