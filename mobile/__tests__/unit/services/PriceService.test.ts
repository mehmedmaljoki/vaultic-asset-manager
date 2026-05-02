import { fetchPrices } from '../../../lib/services/PriceService';
import { TROY_OZ_TO_GRAM } from '../../../lib/models/PriceMap';

// ── Mock fetch globally ───────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

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

function makeGoldApiResponse(symbol: string, pricePerOz: number) {
  return { ok: true, json: async () => ({ symbol, price: pricePerOz, currency: 'EUR' }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue(undefined);
});

describe('fetchPrices — mock provider', () => {
  it('returns cached prices without network call', async () => {
    mockGetCache.mockResolvedValue({ prices: CACHED_PRICES, fetchedAt: { gold: FRESH_AT } });
    const result = await fetchPrices(db, 'EUR', 'mock');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('cache');
    expect(result.prices.gold).toBe(126.0);
  });
});

describe('fetchPrices — goldapi provider, cache fresh', () => {
  it('skips network call when all metal prices are within 15-min TTL', async () => {
    mockGetCache.mockResolvedValue({
      prices: CACHED_PRICES,
      fetchedAt: { gold: FRESH_AT, silver: FRESH_AT, platinum: FRESH_AT, palladium: FRESH_AT },
    });
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('cache');
  });

  it('returns cache even when called via manual refresh within TTL', async () => {
    mockGetCache.mockResolvedValue({
      prices: CACHED_PRICES,
      fetchedAt: { gold: FRESH_AT, silver: FRESH_AT, platinum: FRESH_AT, palladium: FRESH_AT },
    });
    // Call twice (simulating user tapping refresh)
    await fetchPrices(db, 'EUR', 'goldapi');
    await fetchPrices(db, 'EUR', 'goldapi');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('fetchPrices — goldapi provider, cache stale', () => {
  it('fetches live prices and converts troy oz to grams', async () => {
    mockGetCache.mockResolvedValue({
      prices: {},
      fetchedAt: { gold: STALE_AT, silver: STALE_AT, platinum: STALE_AT, palladium: STALE_AT },
    });
    const pricePerOz = 3936.0;
    mockFetch.mockResolvedValue(makeGoldApiResponse('XAU', pricePerOz));

    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(mockFetch).toHaveBeenCalledTimes(4); // XAU, XAG, XPT, XPD
    expect(result.prices.gold).toBeCloseTo(pricePerOz / TROY_OZ_TO_GRAM);
  });

  it('stores fetched prices in cache', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    mockFetch.mockResolvedValue(makeGoldApiResponse('XAU', 3936.0));
    await fetchPrices(db, 'EUR', 'goldapi');
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('returns source=live when all fetches succeed', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    mockFetch.mockResolvedValue(makeGoldApiResponse('XAU', 3936.0));
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(result.source).toBe('live');
  });
});

describe('fetchPrices — network error handling', () => {
  it('returns stale cache when all fetches fail', async () => {
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

  it('returns partial when some fetches succeed and some fail', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    mockFetch
      .mockResolvedValueOnce(makeGoldApiResponse('XAU', 3936.0)) // gold ok
      .mockRejectedValue(new Error('fail'));                       // rest fail
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(result.source).toBe('partial');
    expect(result.prices.gold).toBeDefined();
    expect(result.prices.silver).toBeUndefined();
  });

  it('one symbol failing does not block the others (allSettled)', async () => {
    mockGetCache.mockResolvedValue({ prices: {}, fetchedAt: {} });
    mockFetch
      .mockResolvedValueOnce(makeGoldApiResponse('XAU', 3936.0))
      .mockResolvedValueOnce(makeGoldApiResponse('XAG', 32.0))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(makeGoldApiResponse('XPD', 1200.0));
    const result = await fetchPrices(db, 'EUR', 'goldapi');
    expect(result.prices.gold).toBeDefined();
    expect(result.prices.silver).toBeDefined();
    expect(result.prices.platinum).toBeUndefined();
    expect(result.prices.palladium).toBeDefined();
  });
});
