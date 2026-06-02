import type { HistoryPoint } from '../models/History';

/** Keep only points whose date is within the last `days` relative to `nowMs`. */
export function windowByDays(
  data: HistoryPoint[],
  days: number,
  nowMs: number,
): HistoryPoint[] {
  const cutoff = nowMs - days * 86_400_000;
  return data.filter(p => {
    const t = Date.parse(p.date);
    return !Number.isNaN(t) && t >= cutoff;
  });
}

/** Percent change first→last over the given points. Null if <2 points or first is 0. */
export function percentChange(data: HistoryPoint[]): number | null {
  if (data.length < 2) return null;
  const first = data[0].total;
  const last = data[data.length - 1].total;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

/** Human label for a period in days. */
export function periodLabel(days: number): string {
  if (days >= 365) return 'past year';
  return `past ${days} days`;
}
