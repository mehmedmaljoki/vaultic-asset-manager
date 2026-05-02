import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import type { Asset } from '../models/Asset';
import type { Debt } from '../models/Debt';
import type { HistoryPoint } from '../models/History';
import type { Settings } from '../models/Settings';
import { dbGetAssets, dbAddAsset } from '../repositories/AssetRepository';
import { dbGetDebts, dbAddDebt } from '../repositories/DebtRepository';
import { dbGetHistory, dbInsertHistoryBatch } from '../repositories/HistoryRepository';
import { dbGetSettings, dbSaveSettings } from '../repositories/SettingsRepository';

export interface BackupPayload {
  version: number;
  exportedAt: string;
  assets: Asset[];
  debts: Debt[];
  history: HistoryPoint[];
  settings: Partial<Settings>;
}

export async function exportData(db: SQLiteDatabase): Promise<string> {
  const [assets, debts, history, settings] = await Promise.all([
    dbGetAssets(db),
    dbGetDebts(db),
    dbGetHistory(db, 730),
    dbGetSettings(db),
  ]);
  const payload: BackupPayload = {
    version:    1,
    exportedAt: new Date().toISOString(),
    assets, debts, history, settings,
  };
  return JSON.stringify(payload, null, 2);
}

export async function importData(db: SQLiteDatabase, json: string): Promise<boolean> {
  try {
    const data = JSON.parse(json) as Partial<BackupPayload>;

    await db.withTransactionAsync(async () => {
      if (Array.isArray(data.assets)) {
        await db.runAsync(`DELETE FROM ${TABLES.ASSETS}`);
        for (const a of data.assets) await dbAddAsset(db, a);
      }
      if (Array.isArray(data.debts)) {
        await db.runAsync(`DELETE FROM ${TABLES.DEBTS}`);
        for (const d of data.debts) await dbAddDebt(db, d);
      }
      if (Array.isArray(data.history)) {
        await db.runAsync(`DELETE FROM ${TABLES.HISTORY}`);
        await dbInsertHistoryBatch(db, data.history);
      }
      if (data.settings) {
        await dbSaveSettings(db, data.settings);
      }
    });

    return true;
  } catch {
    return false;
  }
}

export async function clearAllData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM ${TABLES.ASSETS}`);
    await db.runAsync(`DELETE FROM ${TABLES.DEBTS}`);
    await db.runAsync(`DELETE FROM ${TABLES.DEBT_TRANSACTIONS}`);
    await db.runAsync(`DELETE FROM ${TABLES.HISTORY}`);
    await db.runAsync(`DELETE FROM ${TABLES.PRICE_CACHE}`);
    await db.runAsync(`DELETE FROM ${TABLES.SETTINGS} WHERE key != 'migrated_from_asyncstorage'`);
  });
}
