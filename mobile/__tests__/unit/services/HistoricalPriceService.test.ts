import { parseMarketChart, COINGECKO_HISTORY_IDS } from '../../../lib/services/HistoricalPriceService';

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
