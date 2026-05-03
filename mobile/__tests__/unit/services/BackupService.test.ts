import { exportData, importData, BACKUP_VERSION } from '../../../lib/services/BackupService';
import * as AssetRepo from '../../../lib/repositories/AssetRepository';
import * as DebtRepo from '../../../lib/repositories/DebtRepository';
import * as HistoryRepo from '../../../lib/repositories/HistoryRepository';
import * as SettingsRepo from '../../../lib/repositories/SettingsRepository';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Asset } from '../../../lib/models/Asset';
import type { Debt } from '../../../lib/models/Debt';

jest.mock('../../../lib/repositories/AssetRepository');
jest.mock('../../../lib/repositories/DebtRepository');
jest.mock('../../../lib/repositories/HistoryRepository');
jest.mock('../../../lib/repositories/SettingsRepository');

const db = {
  runAsync: jest.fn().mockResolvedValue(undefined),
  withTransactionAsync: jest.fn().mockImplementation(
    async (cb: () => Promise<void>) => cb()
  ),
} as unknown as SQLiteDatabase;

const sampleAsset: Asset = {
  id: 'a1', type: 'money', name: 'Cash', value: 1000,
  currency: 'EUR', createdAt: '2025-01-01T00:00:00Z',
};

const sampleDebt: Debt = {
  id: 'd1', direction: 'owed_to_me', name: 'Bob', amount: 500,
  people: [], transactions: [], createdAt: '2025-01-01T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('exportData', () => {
  it('produces JSON with version + arrays', async () => {
    (AssetRepo.dbGetAssets as jest.Mock).mockResolvedValue([sampleAsset]);
    (DebtRepo.dbGetDebts as jest.Mock).mockResolvedValue([sampleDebt]);
    (HistoryRepo.dbGetHistory as jest.Mock).mockResolvedValue([{ date: '2025-01-01', total: 100 }]);
    (SettingsRepo.dbGetSettings as jest.Mock).mockResolvedValue({ currency: 'EUR' });

    const json = await exportData(db);
    const parsed = JSON.parse(json);

    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.assets).toEqual([sampleAsset]);
    expect(parsed.debts).toEqual([sampleDebt]);
    expect(parsed.history).toHaveLength(1);
    expect(typeof parsed.exportedAt).toBe('string');
  });
});

describe('importData', () => {
  it('returns ok=false on invalid JSON', async () => {
    const out = await importData(db, '{not json');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('invalid_json');
  });

  it('imports valid payload via UPSERT, no DELETE', async () => {
    const payload = JSON.stringify({
      version: 1, exportedAt: 'x',
      assets: [sampleAsset], debts: [sampleDebt],
      history: [{ date: '2025-01-01', total: 100 }],
      settings: { currency: 'USD' },
    });
    const out = await importData(db, payload);
    expect(out.ok).toBe(true);
    expect(out.imported).toEqual({ assets: 1, debts: 1, history: 1 });
    expect(AssetRepo.dbUpsertAsset).toHaveBeenCalledWith(db, expect.objectContaining({ id: 'a1' }));
    expect(DebtRepo.dbUpsertDebt).toHaveBeenCalledWith(db, expect.objectContaining({ id: 'd1' }));
    expect(HistoryRepo.dbInsertHistoryBatch).toHaveBeenCalled();
    expect(SettingsRepo.dbSaveSettings).toHaveBeenCalledWith(db, { currency: 'USD' });
    // Crucially: no destructive DELETE
    expect((db.runAsync as jest.Mock).mock.calls.some(
      ([sql]) => typeof sql === 'string' && sql.toUpperCase().includes('DELETE FROM')
    )).toBe(false);
  });

  it('is idempotent when run twice with the same payload', async () => {
    const payload = JSON.stringify({
      version: 1, exportedAt: 'x',
      assets: [sampleAsset], debts: [sampleDebt],
      history: [{ date: '2025-01-01', total: 100 }],
      settings: {},
    });
    await importData(db, payload);
    await importData(db, payload);
    // UPSERT called twice → DB state ends up identical (no duplicates).
    expect(AssetRepo.dbUpsertAsset).toHaveBeenCalledTimes(2);
    expect(DebtRepo.dbUpsertDebt).toHaveBeenCalledTimes(2);
  });

  it('forward-compat: accepts unknown future version + extra fields', async () => {
    const payload = JSON.stringify({
      version: 99, exportedAt: 'x',
      assets: [{ ...sampleAsset, futureField: 'ignored' }],
      debts: [], history: [], settings: {},
      experimentalArray: [1, 2, 3],
    });
    const out = await importData(db, payload);
    expect(out.ok).toBe(true);
    expect(out.imported.assets).toBe(1);
  });

  it('backward-compat: tolerates missing arrays', async () => {
    const payload = JSON.stringify({ version: 1, assets: [sampleAsset] });
    const out = await importData(db, payload);
    expect(out.ok).toBe(true);
    expect(out.imported.assets).toBe(1);
    expect(out.imported.debts).toBe(0);
    expect(out.imported.history).toBe(0);
  });

  it('skips malformed asset rows but imports valid ones', async () => {
    const payload = JSON.stringify({
      version: 1,
      assets: [
        sampleAsset,
        { id: 'bad', type: 'money' /* missing name + createdAt */ },
        { ...sampleAsset, id: 'a2' },
      ],
      debts: [], history: [], settings: {},
    });
    const out = await importData(db, payload);
    expect(out.ok).toBe(true);
    expect(out.imported.assets).toBe(2);
    expect(out.skipped).toBe(1);
  });

  it('rejects unsupported version 0', async () => {
    const payload = JSON.stringify({ version: 0, assets: [] });
    const out = await importData(db, payload);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('unsupported_version');
  });

  it('handles non-object root gracefully', async () => {
    const out = await importData(db, JSON.stringify(null));
    expect(out.ok).toBe(true);
    expect(out.imported).toEqual({ assets: 0, debts: 0, history: 0 });
  });
});
