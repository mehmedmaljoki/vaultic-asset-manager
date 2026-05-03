import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import {
  backupToCloud, getCloudAdapter, restoreFromCloud,
  type CloudAdapter, type CloudFile,
} from '../services/CloudBackupService';
import { GoogleDriveAdapter, type DriveTokens } from '../services/cloud/GoogleDriveAdapter';
import { dbGetSettings, dbSaveSettings } from '../repositories/SettingsRepository';

export type CloudStatus =
  | 'idle' | 'signing-in' | 'uploading' | 'listing'
  | 'downloading' | 'success' | 'error' | 'unavailable' | 'needs-signin';

export interface UseCloudBackupResult {
  status:       CloudStatus;
  available:    boolean;
  signedIn:     boolean;
  lastError:    string | null;
  files:        CloudFile[];
  signIn:       () => Promise<boolean>;
  signOut:      () => Promise<void>;
  backup:       () => Promise<boolean>;
  refreshFiles: () => Promise<void>;
  restore:      (id: string) => Promise<boolean>;
}

function getGoogleClientId(): string {
  try {
    const Constants = require('expo-constants') as typeof import('expo-constants');
    const extra = Constants.default?.expoConfig?.extra ?? {};
    const id = Platform.OS === 'ios' ? extra.googleIosClientId : extra.googleAndroidClientId;
    return typeof id === 'string' ? id : '';
  } catch { return ''; }
}

function getRedirectUri(): string {
  try {
    const { makeRedirectUri } = require('expo-auth-session') as typeof import('expo-auth-session');
    return makeRedirectUri({ scheme: 'assetmanager', path: 'oauth2redirect' });
  } catch {
    return 'assetmanager://oauth2redirect';
  }
}

export function useCloudBackup(onDataChanged?: () => Promise<void>): UseCloudBackupResult {
  const db = useSQLiteContext();
  const [status,    setStatus]    = useState<CloudStatus>('idle');
  const [files,     setFiles]     = useState<CloudFile[]>([]);
  const [available, setAvailable] = useState(Platform.OS !== 'web');
  const [signedIn,  setSignedIn]  = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const adapterRef   = useRef<CloudAdapter | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); }, []);

  const getAdapter = useCallback(async (): Promise<CloudAdapter | null> => {
    if (!adapterRef.current) {
      try { adapterRef.current = getCloudAdapter(); }
      catch { setAvailable(false); setStatus('unavailable'); return null; }
    }
    if (!(await adapterRef.current.isAvailable())) {
      setAvailable(false); setStatus('unavailable'); return null;
    }
    return adapterRef.current;
  }, []);

  // Load persisted tokens into the adapter on mount
  useEffect(() => {
    (async () => {
      const adapter = await getAdapter();
      if (!(adapter instanceof GoogleDriveAdapter)) return;
      const s = await dbGetSettings(db);
      if (s.gdriveAccessToken) {
        adapter.__setTokens(
          { accessToken: s.gdriveAccessToken, refreshToken: s.gdriveRefreshToken, expiresAt: s.gdriveExpiresAt },
          getGoogleClientId(),
        );
        adapter.onTokensRefreshed = async (t: DriveTokens) => {
          await dbSaveSettings(db, { gdriveAccessToken: t.accessToken, gdriveRefreshToken: t.refreshToken, gdriveExpiresAt: t.expiresAt });
        };
        setSignedIn(true);
      }
    })();
  }, [db, getAdapter]);

  const resetStatus = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setStatus('idle'), 1500);
  }, []);

  const signIn = useCallback(async (): Promise<boolean> => {
    setStatus('signing-in'); setLastError(null);
    const adapter = await getAdapter();
    if (!(adapter instanceof GoogleDriveAdapter)) { setStatus('unavailable'); return false; }
    const clientId = getGoogleClientId();
    if (!clientId) {
      setLastError('Google OAuth client ID not configured (see app.json extra.googleAndroidClientId)');
      setStatus('error'); resetStatus(); return false;
    }
    try {
      const tokens = await adapter.signIn({ clientId, redirectUri: getRedirectUri() });
      if (!tokens) { setStatus('error'); resetStatus(); return false; }
      await dbSaveSettings(db, { gdriveAccessToken: tokens.accessToken, gdriveRefreshToken: tokens.refreshToken, gdriveExpiresAt: tokens.expiresAt });
      adapter.onTokensRefreshed = async (t: DriveTokens) => {
        await dbSaveSettings(db, { gdriveAccessToken: t.accessToken, gdriveRefreshToken: t.refreshToken, gdriveExpiresAt: t.expiresAt });
      };
      setSignedIn(true); setStatus('success'); resetStatus(); return true;
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      setStatus('error'); resetStatus(); return false;
    }
  }, [db, getAdapter, resetStatus]);

  const signOut = useCallback(async () => {
    await dbSaveSettings(db, { gdriveAccessToken: '', gdriveRefreshToken: '', gdriveExpiresAt: 0 });
    adapterRef.current = null;
    setSignedIn(false); setStatus('idle');
  }, [db]);

  const backup = useCallback(async (): Promise<boolean> => {
    const adapter = await getAdapter();
    if (!adapter) return false;
    if (!signedIn) { setStatus('needs-signin'); return false; }
    setStatus('uploading'); setLastError(null);
    try {
      await backupToCloud(db, adapter);
      setStatus('success'); resetStatus(); return true;
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      setStatus('error'); resetStatus(); return false;
    }
  }, [db, getAdapter, signedIn, resetStatus]);

  const refreshFiles = useCallback(async () => {
    const adapter = await getAdapter();
    if (!adapter) return;
    if (!signedIn) { setStatus('needs-signin'); return; }
    setStatus('listing'); setLastError(null);
    try {
      setFiles(await adapter.list());
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    }
    setStatus('idle');
  }, [getAdapter, signedIn]);

  const restore = useCallback(async (id: string): Promise<boolean> => {
    const adapter = await getAdapter();
    if (!adapter) return false;
    if (!signedIn) { setStatus('needs-signin'); return false; }
    setStatus('downloading'); setLastError(null);
    try {
      const ok = await restoreFromCloud(db, adapter, id);
      setStatus(ok ? 'success' : 'error');
      if (ok) await onDataChanged?.();
      resetStatus(); return !!ok;
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
      setStatus('error'); resetStatus(); return false;
    }
  }, [db, getAdapter, signedIn, onDataChanged, resetStatus]);

  return { status, available, signedIn, lastError, files, signIn, signOut, backup, refreshFiles, restore };
}
