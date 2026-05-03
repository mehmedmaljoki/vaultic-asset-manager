import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { authenticate } from '../services/LockService';

export interface UseAppLockResult {
  locked: boolean;
  unlock: (reason: string) => Promise<boolean>;
}

export function useAppLock(lockEnabled: boolean): UseAppLockResult {
  const [locked, setLocked] = useState<boolean>(lockEnabled);
  const wasEnabled = useRef(lockEnabled);

  // If the user toggles `lockEnabled` while the app is open, mirror it.
  useEffect(() => {
    if (lockEnabled && !wasEnabled.current) setLocked(true);
    if (!lockEnabled) setLocked(false);
    wasEnabled.current = lockEnabled;
  }, [lockEnabled]);

  // Re-lock on background/inactive transitions.
  useEffect(() => {
    if (!lockEnabled) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') setLocked(true);
    });
    return () => sub.remove();
  }, [lockEnabled]);

  const unlock = useCallback(async (reason: string) => {
    const ok = await authenticate(reason);
    if (ok) setLocked(false);
    return ok;
  }, []);

  return { locked, unlock };
}
