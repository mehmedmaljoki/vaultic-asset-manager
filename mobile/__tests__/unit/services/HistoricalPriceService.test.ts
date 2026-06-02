import { parseMarketChart, COINGECKO_HISTORY_IDS, fetchHistory } from '../../../lib/services/HistoricalPriceService';
import { TROY_OZ_TO_GRAM } from '../../../lib/models/PriceMap';

/** A fetch stub that resolves to a market_chart payload. */
function okFetch(prices: [number, number][]) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ prices }),
  }) as unknown as typeof fetch;
}

describe('parseMarketChart', () => {
  it('maps CoinGecko market_chart prices to a {YYYY-MM-DD: price} record (last write per day wins)', () => {
    const raw = {
      prices: [
        [Date.parse('2026-06-01T00:00:00Z'), 3800],
        [Date.parse('2026-06-02T00:00:00Z'), 3820],
        [Date.parse('2026-06-02T12:00:00Z'), 3844], // same day, later → wins
      ],
    };
    const map = parseMarketChart(raw);
    expect(map['2026-06-01']).toBe(3800);
    expect(map['2026-06-02']).toBe(3844);
  });

  it('returns an empty map for malformed input', () => {
    expect(parseMarketChart({} as any)).toEqual({});
    expect(parseMarketChart({ prices: null } as any)).toEqual({});
  });
});

describe('COINGECKO_HISTORY_IDS', () => {
  it('maps price keys to CoinGecko ids (gold via PAXG)', () => {
    expect(COINGECKO_HISTORY_IDS.gold).toBe('pax-gold');
    expect(COINGECKO_HISTORY_IDS.bitcoin).toBe('bitcoin');
    expect(COINGECKO_HISTORY_IDS.bnb).toBe('binancecoin');
  });
});

describe('fetchHistory', () => {
  const t1 = Date.parse('2026-06-01T00:00:00Z');

  it('converts gold (PAXG, per troy oz) to per-gram', async () => {
    const fetchFn = okFetch([[t1, 3110.35]]); // 3110.35/oz → 100.00/g
    const map = await fetchHistory('gold', 'eur', 30, fetchFn);
    expect(map['2026-06-01']).toBeCloseTo(3110.35 / TROY_OZ_TO_GRAM, 4);
    expect(map['2026-06-01']).toBeCloseTo(100, 2);
  });

  it('passes crypto prices through unchanged (no per-gram conversion)', async () => {
    const fetchFn = okFetch([[t1, 61000]]);
    const map = await fetchHistory('bitcoin', 'eur', 30, fetchFn);
    expect(map['2026-06-01']).toBe(61000);
  });

  it('requests the correct CoinGecko URL (id, currency, days)', async () => {
    const fetchFn = okFetch([[t1, 1]]);
    await fetchHistory('gold', 'EUR', 90, fetchFn);
    const url = (fetchFn as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/coins/pax-gold/market_chart');
    expect(url).toContain('vs_currency=eur');   // lowercased
    expect(url).toContain('days=90');
  });

  it('returns {} for an unknown / unsupported key (e.g. silver)', async () => {
    const fetchFn = okFetch([[t1, 1]]);
    const map = await fetchHistory('silver' as never, 'eur', 30, fetchFn);
    expect(map).toEqual({});
    expect(fetchFn).not.toHaveBeenCalled();      // no request for unsupported keys
  });

  it('returns {} when the response is not ok (offline-safe)', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof fetch;
    expect(await fetchHistory('bitcoin', 'eur', 30, fetchFn)).toEqual({});
  });

  it('returns {} when fetch throws (offline-safe)', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    expect(await fetchHistory('gold', 'eur', 30, fetchFn)).toEqual({});
  });
});
