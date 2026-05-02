import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';

interface FxRow {
  base:       string;
  currency:   string;
  rate:       number;
  fetched_at: string;
}

export interface FxCacheRead {
  rates:     Record<string, number>;          // currency → multiplier (× to get value in base)
  fetchedAt: Record<string, string | null>;
}

export async function dbGetFxCache(
  db: SQLiteDatabase,
  base: string
): Promise<FxCacheRead> {
  const rows = await db.getAllAsync<FxRow>(
    `SELECT base, currency, rate, fetched_at FROM ${TABLES.FX_CACHE} WHERE base=?`,
    [base]
  );
  const rates:     Record<string, number>          = {};
  const fetchedAt: Record<string, string | null>  = {};
  for (const row of rows) {
    rates[row.currency]     = row.rate;
    fetchedAt[row.currency] = row.fetched_at;
  }
  return { rates, fetchedAt };
}

export async function dbUpsertFxRate(
  db: SQLiteDatabase,
  base: string,
  currency: string,
  rate: number,
  fetchedAt: string
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO ${TABLES.FX_CACHE} (base, currency, rate, fetched_at)
     VALUES (?,?,?,?)`,
    [base, currency, rate, fetchedAt]
  );
}
