import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import type { Asset } from '../models/Asset';
import type { Debt } from '../models/Debt';
import type { HistoryPoint } from '../models/History';
import type { Settings } from '../models/Settings';
import { dbGetAssets, dbUpsertAsset } from '../repositories/AssetRepository';
import { dbGetDebts, dbUpsertDebt } from '../repositories/DebtRepository';
import { dbGetHistory, dbInsertHistoryBatch } from '../repositories/HistoryRepository';
import { dbGetSettings, dbSaveSettings } from '../repositories/SettingsRepository';

export const BACKUP_VERSION = 1;

export interface BackupPayload {
  version: number;
  exportedAt: string;
  assets: Asset[];
  debts: Debt[];
  history: HistoryPoint[];
  settings: Partial<Settings>;
}

export interface ImportResult {
  ok: boolean;
  imported: { assets: number; debts: number; history: number };
  skipped: number;
  reason?: string;
}

export async function exportData(db: SQLiteDatabase): Promise<string> {
  const [assets, debts, history, settings] = await Promise.all([
    dbGetAssets(db),
    dbGetDebts(db),
    dbGetHistory(db, 730),
    dbGetSettings(db),
  ]);
  const payload: BackupPayload = {
    version:    BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    assets, debts, history, settings,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Forward/backward-compat normalizer. Tolerates missing arrays, unknown extra
 * fields (passed through, ignored by repository mappers), and future versions
 * (best-effort import — unknown fields are silently dropped).
 */
function migrateBackupPayload(raw: unknown): Partial<BackupPayload> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  return {
    version:    typeof r.version === 'number' ? r.version : BACKUP_VERSION,
    exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : undefined,
    assets:     Array.isArray(r.assets)   ? r.assets   as Asset[]         : [],
    debts:      Array.isArray(r.debts)    ? r.debts    as Debt[]          : [],
    history:    Array.isArray(r.history)  ? r.history  as HistoryPoint[]  : [],
    settings:   r.settings && typeof r.settings === 'object'
                  ? r.settings as Partial<Settings>
                  : {},
  };
}

function isValidAsset(a: unknown): a is Asset {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  return typeof x.id === 'string'
      && typeof x.type === 'string'
      && typeof x.name === 'string'
      && typeof x.createdAt === 'string';
}

function isValidDebt(d: unknown): d is Debt {
  if (!d || typeof d !== 'object') return false;
  const x = d as Record<string, unknown>;
  return typeof x.id === 'string'
      && (x.direction === 'owed_to_me' || x.direction === 'i_owe')
      && typeof x.name === 'string'
      && typeof x.amount === 'number'
      && typeof x.createdAt === 'string';
}

function isValidHistoryPoint(p: unknown): p is HistoryPoint {
  if (!p || typeof p !== 'object') return false;
  const x = p as Record<string, unknown>;
  return typeof x.date === 'string' && typeof x.total === 'number';
}

/**
 * Idempotent import. Re-running with the same payload is a no-op (UPSERT on id
 * for assets/debts, INSERT OR IGNORE on (date,total) for history). Skips
 * malformed entries instead of failing the whole import.
 */
export async function importData(db: SQLiteDatabase, json: string): Promise<ImportResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, imported: { assets: 0, debts: 0, history: 0 }, skipped: 0, reason: 'invalid_json' };
  }
  const data = migrateBackupPayload(raw);
  if (typeof data.version === 'number' && data.version < 1) {
    return { ok: false, imported: { assets: 0, debts: 0, history: 0 }, skipped: 0, reason: 'unsupported_version' };
  }

  const counts = { assets: 0, debts: 0, history: 0 };
  let skipped = 0;

  try {
    await db.withTransactionAsync(async () => {
      for (const a of data.assets ?? []) {
        if (!isValidAsset(a)) { skipped++; continue; }
        try {
          await dbUpsertAsset(db, {
            ...a,
            transactions: undefined as never, // strip foreign fields
          } as Asset);
          counts.assets++;
        } catch { skipped++; }
      }
      for (const d of data.debts ?? []) {
        if (!isValidDebt(d)) { skipped++; continue; }
        try {
          await dbUpsertDebt(db, {
            ...d,
            people: Array.isArray(d.people) ? d.people : [],
            transactions: Array.isArray(d.transactions) ? d.transactions : [],
          } as Debt);
          counts.debts++;
        } catch { skipped++; }
      }
      const validHistory = (data.history ?? []).filter(isValidHistoryPoint);
      skipped += (data.history?.length ?? 0) - validHistory.length;
      if (validHistory.length > 0) {
        await dbInsertHistoryBatch(db, validHistory);
        counts.history = validHistory.length;
      }
      if (data.settings && Object.keys(data.settings).length > 0) {
        await dbSaveSettings(db, data.settings);
      }
    });
    return { ok: true, imported: counts, skipped };
  } catch (e) {
    return { ok: false, imported: counts, skipped, reason: e instanceof Error ? e.message : 'unknown' };
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
