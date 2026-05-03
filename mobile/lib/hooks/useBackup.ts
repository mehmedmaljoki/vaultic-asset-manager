import { useState, useCallback, useEffect, useRef } from 'react';
import { Share } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import { exportData, importData, clearAllData } from '../services/BackupService';

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
      await Share.share({ title: 'Asset Manager Backup', message: json });
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
      const res  = await fetch(result.assets[0].uri);
      const json = await res.text();
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
