import { buildBackfillSeries } from '../../../lib/services/HistoryBackfillService';
import type { Asset } from '../../../lib/models/Asset';

const goldCoin: Asset = {
  id: 'g', type: 'metals', subtype: 'gold', name: 'Coin',
  quantity: 2, purity: 999, gramsPerUnit: 31.1035,   // ~2 oz pure
  purchasedAt: '2026-05-30T00:00:00Z', createdAt: '2026-05-30T00:00:00Z',
};
const cash: Asset = {
  id: 'c', type: 'money', name: 'Cash', value: 1000, currency: 'EUR',
  purchasedAt: '2026-05-31T00:00:00Z', createdAt: '2026-05-31T00:00:00Z',
};

// Historical gold price per gram by day.
const histByKey = { gold: { '2026-05-30': 100, '2026-05-31': 110, '2026-06-01': 120 } };

describe('buildBackfillSeries', () => {
  it('values only assets held on each day, using that day price', () => {
    const series = buildBackfillSeries(
      [goldCoin, cash],
      ['2026-05-30', '2026-05-31', '2026-06-01'],
      histByKey,
      {},   // currentPrices fallback
      {},   // fxRates
    );
    // Day 1: only gold held → 2*31.1035*100*0.999 ≈ 6214.5
    expect(series[0].date).toBe('2026-05-30');
    expect(series[0].total).toBeCloseTo(2 * 31.1035 * 100 * 0.999, 1);
    // Day 2: gold@110 + cash 1000
    expect(series[1].total).toBeCloseTo(2 * 31.1035 * 110 * 0.999 + 1000, 1);
    // Day 3: gold@120 + cash 1000
    expect(series[2].total).toBeCloseTo(2 * 31.1035 * 120 * 0.999 + 1000, 1);
  });

  it('falls back to currentPrices when a day has no historical sample', () => {
    const series = buildBackfillSeries(
      [goldCoin], ['2026-06-02'], { gold: {} }, { gold: 130 }, {},
    );
    expect(series[0].total).toBeCloseTo(2 * 31.1035 * 130 * 0.999, 1);
  });
});
