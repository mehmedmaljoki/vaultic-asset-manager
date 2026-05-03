import { Platform } from 'react-native';
import * as CB from '../../../lib/services/CloudBackupService';
import * as BackupService from '../../../lib/services/BackupService';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('../../../lib/services/BackupService');

const db = {} as SQLiteDatabase;

beforeEach(() => {
  jest.clearAllMocks();
  (BackupService.exportData as jest.Mock).mockResolvedValue('{"version":1,"assets":[]}');
  (BackupService.importData as jest.Mock).mockResolvedValue({ ok: true, imported: { assets: 0, debts: 0, history: 0 }, skipped: 0 });
});

describe('getCloudAdapter', () => {
  it('throws on web', () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'web', configurable: true });
    expect(() => CB.getCloudAdapter()).toThrow();
  });

  it('returns gdrive on android', () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
    expect(CB.getCloudAdapter().name).toBe('gdrive');
  });

  it('returns icloud on ios', () => {
    Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true });
    expect(CB.getCloudAdapter().name).toBe('icloud');
  });
});

describe('backupToCloud / restoreFromCloud', () => {
  const adapter: CB.CloudAdapter = {
    name: 'gdrive',
    isAvailable: jest.fn().mockResolvedValue(true),
    upload: jest.fn().mockResolvedValue(undefined),
    list:   jest.fn().mockResolvedValue([{ id: 'x', name: 'oam.json', modifiedAt: '' }]),
    download: jest.fn().mockResolvedValue('{"version":1,"assets":[]}'),
  };

  it('round-trips export → upload → list → download → import', async () => {
    await CB.backupToCloud(db, adapter);
    expect(BackupService.exportData).toHaveBeenCalledWith(db);
    expect(adapter.upload).toHaveBeenCalled();

    const files = await adapter.list();
    const ok = await CB.restoreFromCloud(db, adapter, files[0].id);
    expect(adapter.download).toHaveBeenCalledWith('x');
    expect(BackupService.importData).toHaveBeenCalled();
    expect(ok).toBe(true);
  });
});
