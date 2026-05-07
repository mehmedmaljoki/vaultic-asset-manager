import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { exportData, importData } from './BackupService';
import { GoogleDriveAdapter } from './cloud/GoogleDriveAdapter';
import { ICloudAdapter } from './cloud/ICloudAdapter';

export interface CloudFile {
  id: string;
  name: string;
  modifiedAt: string;
}

export interface CloudAdapter {
  name: 'gdrive' | 'icloud';
  isAvailable(): Promise<boolean>;
  upload(filename: string, json: string): Promise<void>;
  list(): Promise<CloudFile[]>;
  download(id: string): Promise<string>;
}

export function getCloudAdapter(): CloudAdapter {
  if (Platform.OS === 'android') return new GoogleDriveAdapter();
  if (Platform.OS === 'ios')     return new ICloudAdapter();
  throw new Error('cloud_backup_unavailable_web');
}

export async function backupToCloud(
  db: SQLiteDatabase,
  adapter: CloudAdapter,
): Promise<void> {
  const json     = await exportData(db);
  const filename = `oam_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await adapter.upload(filename, json);
}

export async function restoreFromCloud(
  db: SQLiteDatabase,
  adapter: CloudAdapter,
  fileId: string,
): Promise<boolean> {
  const json = await adapter.download(fileId);
  const out  = await importData(db, json);
  return out.ok;
}
