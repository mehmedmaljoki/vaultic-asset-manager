import type { SQLiteDatabase } from 'expo-sqlite';
import { dbUpsertDailyHistory } from '../../../lib/repositories/HistoryRepository';

/** Build a fake SQLiteDatabase whose getFirstAsync returns `existing`. */
function makeDb(existing: { id: number } | null) {
  const runAsync = jest.fn().mockResolvedValue(undefined);
  const getFirstAsync = jest.fn().mockResolvedValue(existing);
  const db = { runAsync, getFirstAsync } as unknown as SQLiteDatabase;
  return { db, runAsync, getFirstAsync };
}

describe('dbUpsertDailyHistory', () => {
  it('INSERTs a new row when no point exists for today', async () => {
    const { db, runAsync, getFirstAsync } = makeDb(null);
    await dbUpsertDailyHistory(db, 5000, '2026-06-02T10:00:00.000Z');

    // Looked up by the calendar-day prefix.
    expect(getFirstAsync).toHaveBeenCalledTimes(1);
    expect(getFirstAsync.mock.calls[0][1]).toEqual(['2026-06-02']);

    // Exactly one write, and it is an INSERT (not UPDATE).
    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO/);
    expect(sql).not.toMatch(/UPDATE/);
    expect(params).toEqual(['2026-06-02T10:00:00.000Z', 5000]);
  });

  it('UPDATEs the existing row when a point for today already exists', async () => {
    const { db, runAsync } = makeDb({ id: 42 });
    await dbUpsertDailyHistory(db, 5100, '2026-06-02T18:00:00.000Z');

    expect(runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = runAsync.mock.calls[0];
    expect(sql).toMatch(/UPDATE/);
    expect(sql).not.toMatch(/INSERT/);
    // total, date, id — refreshes the day's value to the latest.
    expect(params).toEqual([5100, '2026-06-02T18:00:00.000Z', 42]);
  });

  it('matches a backfilled plain-date row (substr day-prefix), preventing a duplicate', async () => {
    // A backfill row stored its date as plain 'YYYY-MM-DD'. The lookup keys on the
    // same day prefix, so getFirstAsync would find it → we UPDATE, not double-insert.
    const { db, runAsync } = makeDb({ id: 7 });
    await dbUpsertDailyHistory(db, 5200, '2026-06-02T09:30:00.000Z');
    expect(runAsync.mock.calls[0][0]).toMatch(/UPDATE/);
    expect(runAsync.mock.calls[0][1]).toEqual([5200, '2026-06-02T09:30:00.000Z', 7]);
  });
});
