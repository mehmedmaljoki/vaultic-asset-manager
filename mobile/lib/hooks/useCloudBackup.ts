import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportData, importData } from '../services/BackupService';

export type CloudStatus = 'idle' | 'uploading' | 'downloading' | 'success' | 'error';

export interface UseCloudBackupResult {
  status:    CloudStatus;
  available: boolean;
  lastError: string | null;
  backup:    () => Promise<boolean>;
  restore:   () => Promise<boolean>;
}

/**
 * Cloud backup via the OS share sheet: the user picks their own cloud storage
 * provider (Google Drive, Dropbox, iCloud Drive, etc.) from the system dialog.
 * No OAuth credentials required.
 */
export function useCloudBackup(onDataChanged?: () => Promise<void>): UseCloudBackupResult {
  const db = useSQLiteContext();
  const [status,    setStatus]    = useState<CloudStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const scheduleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus('idle'), 1500);
  }, []);

  const backup = useCallback(async (): Promise<boolean> => {
    setStatus('uploading'); setLastError(null);
    try {
      const json = await exportData(db);
      const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const path = `${FileSystem.cacheDirectory ?? ''}oam_backup_${ts}.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, {
        mimeType:    'application/json',
        dialogTitle: 'Vaultic Cloud Backup',
        UTI:         'public.json',
      });
      setStatus('success'); scheduleReset(); return true;
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      setStatus('error'); scheduleReset(); return false;
    }
  }, [db, scheduleReset]);

  const restore = useCallback(async (): Promise<boolean> => {
    setStatus('downloading'); setLastError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        setStatus('idle'); return false;
      }
      const json = await fetch(result.assets[0].uri).then(r => r.text());
      const out  = await importData(db, json);
      setStatus(out.ok ? 'success' : 'error');
      if (out.ok) await onDataChanged?.();
      scheduleReset(); return out.ok;
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      setStatus('error'); scheduleReset(); return false;
    }
  }, [db, onDataChanged, scheduleReset]);

  return {
    status,
    available: Platform.OS !== 'web',
    lastError,
    backup,
    restore,
  };
}
