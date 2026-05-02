import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import type { HistoryPoint } from '../models/History';

const MAX_HISTORY_ROWS = 730;

export async function dbGetHistory(
  db: SQLiteDatabase,
  limit = 365
): Promise<HistoryPoint[]> {
  const rows = await db.getAllAsync<{ date: string; total: number }>(
    `SELECT date, total FROM ${TABLES.HISTORY} ORDER BY date ASC LIMIT ?`,
    [limit]
  );
  return rows;
}

export async function dbSnapHistory(db: SQLiteDatabase, total: number): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO ${TABLES.HISTORY} (date, total) VALUES (?,?)`,
    [now, total]
  );
  const count = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM ${TABLES.HISTORY}`
  );
  if (count && count.n > MAX_HISTORY_ROWS) {
    await db.runAsync(
      `DELETE FROM ${TABLES.HISTORY} WHERE id IN
       (SELECT id FROM ${TABLES.HISTORY} ORDER BY date ASC LIMIT ?)`,
      [count.n - MAX_HISTORY_ROWS]
    );
  }
}

export async function dbInsertHistoryBatch(
  db: SQLiteDatabase,
  points: HistoryPoint[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const p of points) {
      await db.runAsync(
        `INSERT INTO ${TABLES.HISTORY} (date, total) VALUES (?,?)`,
        [p.date, p.total]
      );
    }
  });
}
