import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import type { LivePrices } from '../models/PriceMap';
import { SUBTYPE_TO_PRICE_KEY } from '../models/PriceMap';

interface CacheRow {
  symbol: string;
  currency: string;
  price: number;
  fetched_at: string;
}

export async function dbGetPriceCache(
  db: SQLiteDatabase,
  currency: string
): Promise<{ prices: Partial<LivePrices>; fetchedAt: Record<string, string | null> }> {
  const rows = await db.getAllAsync<CacheRow>(
    `SELECT symbol, currency, price, fetched_at FROM ${TABLES.PRICE_CACHE} WHERE currency=?`,
    [currency]
  );
  const prices: Partial<LivePrices> = {};
  const fetchedAt: Record<string, string | null> = {};

  for (const row of rows) {
    const key = SUBTYPE_TO_PRICE_KEY[row.symbol.toLowerCase()] as keyof LivePrices | undefined
               ?? (Object.values(SUBTYPE_TO_PRICE_KEY).find(v => v === row.symbol.toLowerCase()));
    if (key) {
      (prices as Record<string, number>)[key] = row.price;
      fetchedAt[key] = row.fetched_at;
    }
  }
  return { prices, fetchedAt };
}

export async function dbUpsertPriceCache(
  db: SQLiteDatabase,
  symbol: string,
  currency: string,
  price: number,
  fetchedAt: string
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO ${TABLES.PRICE_CACHE} (symbol, currency, price, fetched_at)
     VALUES (?,?,?,?)`,
    [symbol, currency, price, fetchedAt]
  );
}
