import type { CloudAdapter, CloudFile } from '../CloudBackupService';

/**
 * iCloud adapter using the key-value store (`react-native-icloudstore`).
 * Backups are stored under keys with the `oam_backup_` prefix; the value is
 * the same JSON payload that `BackupService.exportData` produces.
 *
 * Limit: iCloud KVS values are capped near 1 MB. For larger backups a future
 * version should switch to the ubiquity container; today the app's payload
 * is far below that ceiling so KVS is fine.
 */

const PREFIX = 'oam_backup_';

interface ICloudKVS {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  getAllKeys: () => Promise<string[]>;
  removeItem?: (key: string) => Promise<void>;
}

function getKVS(): ICloudKVS | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-icloudstore');
    return (mod?.default ?? mod) as ICloudKVS;
  } catch {
    return null;
  }
}

export class ICloudAdapter implements CloudAdapter {
  readonly name = 'icloud' as const;

  async isAvailable(): Promise<boolean> {
    return getKVS() !== null;
  }

  async upload(filename: string, json: string): Promise<void> {
    const kvs = getKVS();
    if (!kvs) throw new Error('icloud_unavailable');
    const key = `${PREFIX}${filename}`;
    await kvs.setItem(key, json);
  }

  async list(): Promise<CloudFile[]> {
    const kvs = getKVS();
    if (!kvs) return [];
    const keys = (await kvs.getAllKeys()).filter(k => k.startsWith(PREFIX));
    return keys.map(k => ({ id: k, name: k.slice(PREFIX.length), modifiedAt: '' }));
  }

  async download(id: string): Promise<string> {
    const kvs = getKVS();
    if (!kvs) throw new Error('icloud_unavailable');
    const v = await kvs.getItem(id);
    if (v == null) throw new Error('icloud_not_found');
    return v;
  }
}
