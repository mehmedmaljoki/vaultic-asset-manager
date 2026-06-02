import { dayKey, shouldSnapshotToday } from '../../../lib/services/HistoryService';
import type { HistoryPoint } from '../../../lib/models/History';

describe('dayKey', () => {
  it('truncates an ISO timestamp to YYYY-MM-DD (UTC)', () => {
    expect(dayKey('2026-06-02T14:33:00.000Z')).toBe('2026-06-02');
    expect(dayKey('2026-06-02T00:00:00.000Z')).toBe('2026-06-02');
  });
});

describe('shouldSnapshotToday', () => {
  const today = '2026-06-02T10:00:00.000Z';

  it('is true when history has no point for today', () => {
    const h: HistoryPoint[] = [{ date: '2026-06-01T09:00:00.000Z', total: 100 }];
    expect(shouldSnapshotToday(h, today)).toBe(true);
  });

  it('is false when a point already exists for today', () => {
    const h: HistoryPoint[] = [{ date: '2026-06-02T08:00:00.000Z', total: 100 }];
    expect(shouldSnapshotToday(h, today)).toBe(false);
  });

  it('is true for empty history', () => {
    expect(shouldSnapshotToday([], today)).toBe(true);
  });
});
