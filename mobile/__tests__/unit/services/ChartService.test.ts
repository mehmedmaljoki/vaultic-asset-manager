import { windowByDays, percentChange, periodLabel } from '../../../lib/services/ChartService';
import type { HistoryPoint } from '../../../lib/models/History';

const DAY = 86_400_000;
const iso = (msAgo: number) => new Date(1_900_000_000_000 - msAgo).toISOString();
// Fixed "now" so tests are deterministic.
const NOW = 1_900_000_000_000;

const series: HistoryPoint[] = [
  { date: iso(400 * DAY), total: 100 },  // ~400 days ago
  { date: iso(50 * DAY),  total: 200 },  // within 60d
  { date: iso(10 * DAY),  total: 260 },  // within 60d
];

describe('windowByDays', () => {
  it('keeps only points within the last N days relative to now', () => {
    const w = windowByDays(series, 60, NOW);
    expect(w.map(p => p.total)).toEqual([200, 260]);
  });

  it('returns all points when the window covers the whole series', () => {
    const w = windowByDays(series, 365, NOW);
    expect(w.length).toBe(2); // 400d-old point excluded, 50d & 10d included
  });

  it('returns empty when no point falls in the window', () => {
    expect(windowByDays(series, 5, NOW)).toEqual([]);
  });
});

describe('percentChange', () => {
  it('computes (last-first)/first*100 over the window', () => {
    const w = windowByDays(series, 60, NOW); // [200, 260]
    expect(percentChange(w)).toBeCloseTo(30); // (260-200)/200*100
  });

  it('returns null when fewer than 2 points', () => {
    expect(percentChange([{ date: iso(0), total: 200 }])).toBeNull();
    expect(percentChange([])).toBeNull();
  });

  it('returns null when first total is 0 (avoid divide-by-zero)', () => {
    const z: HistoryPoint[] = [{ date: iso(2 * DAY), total: 0 }, { date: iso(DAY), total: 50 }];
    expect(percentChange(z)).toBeNull();
  });
});

describe('periodLabel', () => {
  it('formats day counts to human labels', () => {
    expect(periodLabel(7)).toBe('past 7 days');
    expect(periodLabel(60)).toBe('past 60 days');
    expect(periodLabel(365)).toBe('past year');
  });
});
