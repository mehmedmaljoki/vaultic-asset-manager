import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportData, importData, clearAllData } from '../services/BackupService';
import { applySystemDefaults } from '../services/SystemDefaultsService';

export type BackupStatus = 'idle' | 'exporting' | 'importing' | 'clearing' | 'success' | 'error';

export interface UseBackupResult {
  status:       BackupStatus;
  handleExport: () => Promise<void>;
  handleImport: () => Promise<boolean>;
  handleClear:  () => Promise<void>;
}

export function useBackup(onDataChanged?: () => Promise<void>): UseBackupResult {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<BackupStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function scheduleReset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus('idle'), 2000);
  }

  const handleExport = useCallback(async () => {
    setStatus('exporting');
    try {
      const json = await exportData(db);
      const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      if (Platform.OS !== 'web') {
        const file = new File(Paths.cache, `oam_backup_${ts}.json`);
        if (file.exists) file.delete();
        file.create();
        file.write(json);
        await Sharing.shareAsync(file.uri, {
          mimeType:    'application/json',
          dialogTitle: 'Vaultic Backup',
          UTI:         'public.json',
        });
      }
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      scheduleReset();
    }
  }, [db]);

  const handleImport = useCallback(async (): Promise<boolean> => {
    setStatus('importing');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) {
        setStatus('idle');
        return false;
      }
      const json = await new File(result.assets[0].uri).text();
      const out  = await importData(db, json);
      setStatus(out.ok ? 'success' : 'error');
      if (out.ok) await onDataChanged?.();
      scheduleReset();
      return out.ok;
    } catch {
      setStatus('error');
      scheduleReset();
      return false;
    }
  }, [db, onDataChanged]);

  const handleClear = useCallback(async () => {
    setStatus('clearing');
    try {
      await clearAllData(db);
      await applySystemDefaults(db);
      await onDataChanged?.();
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      scheduleReset();
    }
  }, [db, onDataChanged]);

  return { status, handleExport, handleImport, handleClear };
}
