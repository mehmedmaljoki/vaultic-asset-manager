import type { HistoryPoint } from '../models/History';

/** UTC calendar-day key (YYYY-MM-DD) of an ISO timestamp. */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** True when no history point exists for the calendar day of `nowIso`. */
export function shouldSnapshotToday(history: HistoryPoint[], nowIso: string): boolean {
  const today = dayKey(nowIso);
  return !history.some(p => dayKey(p.date) === today);
}
