import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import Constants from 'expo-constants';
import { useApp } from '../AppContext';
import { GoogleDriveAdapter } from '../services/cloud/GoogleDriveAdapter';
import { backupToCloud, restoreFromCloud } from '../services/CloudBackupService';
import { dbGetSettings, dbSaveSettings } from '../repositories/SettingsRepository';

export type CloudStatus = 'idle' | 'uploading' | 'downloading' | 'success' | 'error';

export interface UseCloudBackupResult {
  status:    CloudStatus;
  available: boolean;
  lastError: string | null;
  backup:    () => Promise<boolean>;
  restore:   () => Promise<boolean>;
}

const REDIRECT_URI = 'vaultic://oauth2redirect';

function getClientId(): string {
  return (Constants.expoConfig?.extra?.googleAndroidClientId as string | undefined) ?? '';
}

export function useCloudBackup(onDataChanged?: () => Promise<void>): UseCloudBackupResult {
  const db = useSQLiteContext();
  const { t } = useApp();
  const [status,    setStatus]    = useState<CloudStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const adapterRef = useRef<GoogleDriveAdapter | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const scheduleReset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus('idle'), 2000);
  }, []);

  const clearTokens = useCallback(() =>
    dbSaveSettings(db, { gdriveAccessToken: '', gdriveRefreshToken: '', gdriveExpiresAt: 0 }),
  [db]);

  const getAdapter = useCallback(async () => {
    if (!adapterRef.current) adapterRef.current = new GoogleDriveAdapter();
    const adapter = adapterRef.current;
    const cid = getClientId();

    const s = await dbGetSettings(db);
    if (s.gdriveAccessToken) {
      adapter.__setTokens(
        { accessToken: s.gdriveAccessToken, refreshToken: s.gdriveRefreshToken, expiresAt: s.gdriveExpiresAt },
        cid,
      );
    }
    // Persist refreshed tokens immediately so they survive app restarts
    adapter.onTokensRefreshed = (tokens) => {
      void dbSaveSettings(db, {
        gdriveAccessToken: tokens.accessToken,
        gdriveRefreshToken: tokens.refreshToken,
        gdriveExpiresAt:    tokens.expiresAt,
      });
    };
    return adapter;
  }, [db]);

  // Ensures the adapter has a valid token, triggering OAuth if needed.
  const ensureAuth = useCallback(async (adapter: GoogleDriveAdapter): Promise<boolean> => {
    const cid = getClientId();
    if (!cid) throw new Error('Google OAuth Client ID not configured (googleAndroidClientId in app.json)');

    const s = await dbGetSettings(db);
    if (s.gdriveAccessToken) return true;

    // No stored token — open system browser for PKCE sign-in
    const tokens = await adapter.signIn({ clientId: cid, redirectUri: REDIRECT_URI });
    if (!tokens) return false; // user cancelled

    await dbSaveSettings(db, {
      gdriveAccessToken: tokens.accessToken,
      gdriveRefreshToken: tokens.refreshToken,
      gdriveExpiresAt:    tokens.expiresAt,
    });
    return true;
  }, [db]);

  const backup = useCallback(async (): Promise<boolean> => {
    setStatus('uploading'); setLastError(null);
    try {
      const adapter = await getAdapter();
      const authed  = await ensureAuth(adapter);
      if (!authed) { setStatus('idle'); return false; }

      await backupToCloud(db, adapter);
      setStatus('success'); scheduleReset(); return true;
    } catch (e) {
      // Refresh token revoked — force re-login on next attempt
      if (e instanceof Error && e.message === 'not_signed_in') {
        await clearTokens(); adapterRef.current = null;
      }
      setLastError(e instanceof Error ? e.message : String(e));
      setStatus('error'); scheduleReset(); return false;
    }
  }, [db, getAdapter, ensureAuth, clearTokens, scheduleReset]);

  const restore = useCallback(async (): Promise<boolean> => {
    setStatus('downloading'); setLastError(null);
    try {
      const adapter = await getAdapter();
      const authed  = await ensureAuth(adapter);
      if (!authed) { setStatus('idle'); return false; }

      const files = await adapter.list();
      if (files.length === 0) {
        Alert.alert(t('cloud_no_backups'), t('cloud_no_backups_msg'));
        setStatus('idle'); return false;
      }

      // Present a native picker (most recent first, up to 4 entries)
      const fileId = await new Promise<string | null>((resolve) => {
        Alert.alert(
          t('cloud_pick_title'),
          t('cloud_pick_msg'),
          [
            ...files.slice(0, 4).map(f => ({
              text:    new Date(f.modifiedAt).toLocaleString(),
              onPress: () => resolve(f.id),
            })),
            { text: t('asset_cancel'), style: 'cancel' as const, onPress: () => resolve(null) },
          ],
        );
      });

      if (!fileId) { setStatus('idle'); return false; }

      const ok = await restoreFromCloud(db, adapter, fileId);
      setStatus(ok ? 'success' : 'error');
      if (ok) await onDataChanged?.();
      scheduleReset(); return ok;
    } catch (e) {
      if (e instanceof Error && e.message === 'not_signed_in') {
        await clearTokens(); adapterRef.current = null;
      }
      setLastError(e instanceof Error ? e.message : String(e));
      setStatus('error'); scheduleReset(); return false;
    }
  }, [db, getAdapter, ensureAuth, clearTokens, onDataChanged, t, scheduleReset]);

  return {
    status,
    available: Platform.OS !== 'web',
    lastError,
    backup,
    restore,
  };
}
