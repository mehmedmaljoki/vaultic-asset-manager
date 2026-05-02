import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import { SETTINGS_DEFAULTS, type Settings } from '../models/Settings';

export async function dbGetSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM ${TABLES.SETTINGS}`
  );
  const map: Record<string, unknown> = {};
  for (const { key, value } of rows) {
    try { map[key] = JSON.parse(value); } catch { map[key] = value; }
  }
  return { ...SETTINGS_DEFAULTS, ...map } as Settings;
}

export async function dbSaveSettings(
  db: SQLiteDatabase,
  patch: Partial<Settings>
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [key, val] of Object.entries(patch)) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${TABLES.SETTINGS} (key, value) VALUES (?,?)`,
        [key, JSON.stringify(val)]
      );
    }
  });
}
