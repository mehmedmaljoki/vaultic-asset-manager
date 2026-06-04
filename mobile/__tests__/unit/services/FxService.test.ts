import { fetchFxRates } from '../../../lib/services/FxService';

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch as unknown as typeof fetch;

const mockGetCache = jest.fn();
const mockUpsert   = jest.fn();
jest.mock('../../../lib/repositories/FxCacheRepository', () => ({
  dbGetFxCache:    (...a: unknown[]) => mockGetCache(...a),
  dbUpsertFxRate:  (...a: unknown[]) => mockUpsert(...a),
}));

const db = {} as import('expo-sqlite').SQLiteDatabase;

const FRESH_AT  = new Date(Date.now() - 60 * 60 * 1000).toISOString();        // 1 h ago
const STALE_AT  = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();   // 26 h ago

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockResolvedValue(undefined);
});

describe('fetchFxRates — cache fresh', () => {
  it('skips network call when all cached rates are within TTL', async () => {
    mockGetCache.mockResolvedValue({
      rates:     { USD: 1 / 1.08, GBP: 1 / 0.85 },
      fetchedAt: { USD: FRESH_AT, GBP: FRESH_AT },
    });
    const result = await fetchFxRates(db, 'EUR');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.source).toBe('cache');
    expect(result.rates.EUR).toBe(1);
    expect(result.rates.USD).toBeCloseTo(1 / 1.08);
  });
});

describe('fetchFxRates — cache stale', () => {
  it('fetches live rates and inverts base→other into other→base', async () => {
    mockGetCache.mockResolvedValue({ rates: {}, fetchedAt: {} });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ base: 'EUR', date: '2026-05-01', rates: { USD: 1.08, GBP: 0.85 } }),
    });
    const result = await fetchFxRates(db, 'EUR');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('live');
    expect(result.rates.EUR).toBe(1);
    expect(result.rates.USD).toBeCloseTo(1 / 1.08);
    expect(result.rates.GBP).toBeCloseTo(1 / 0.85);
    // Each currency upserted once
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});

describe('fetchFxRates — offline / network failure', () => {
  it('returns cached rates with source=offline when fetch throws', async () => {
    mockGetCache.mockResolvedValue({
      rates:     { USD: 1 / 1.08 },
      fetchedAt: { USD: STALE_AT },
    });
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchFxRates(db, 'EUR');
    expect(result.source).toBe('offline');
    expect(result.rates.USD).toBeCloseTo(1 / 1.08);
    expect(result.rates.EUR).toBe(1);
  });

  it('returns offline with only base=1 when no cache and no network', async () => {
    mockGetCache.mockResolvedValue({ rates: {}, fetchedAt: {} });
    mockFetch.mockRejectedValueOnce(new Error('fail'));
    const result = await fetchFxRates(db, 'EUR');
    expect(result.source).toBe('offline');
    expect(Object.keys(result.rates)).toEqual(['EUR']);
    expect(result.rates.EUR).toBe(1);
  });

  it('returns offline when API responds non-ok', async () => {
    mockGetCache.mockResolvedValue({ rates: {}, fetchedAt: {} });
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const result = await fetchFxRates(db, 'EUR');
    expect(result.source).toBe('offline');
  });
});
