/**
 * Thin wrapper around `expo-local-authentication` so the rest of the app
 * doesn't import it directly. The dep is optional in this repo (added by the
 * cloud-build profile); when it's missing every call resolves to a safe
 * "unavailable" state so dev builds without the native module still work.
 */

export type AuthType = 'face' | 'fingerprint' | 'iris' | 'unknown';

interface LAModule {
  hasHardwareAsync: () => Promise<boolean>;
  isEnrolledAsync: () => Promise<boolean>;
  supportedAuthenticationTypesAsync: () => Promise<number[]>;
  authenticateAsync: (opts: {
    promptMessage: string;
    fallbackLabel?: string;
    disableDeviceFallback?: boolean;
  }) => Promise<{ success: boolean }>;
  AuthenticationType: { FINGERPRINT: number; FACIAL_RECOGNITION: number; IRIS: number };
}

function getLA(): LAModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as LAModule;
  } catch {
    return null;
  }
}

export type LockUnavailableReason = 'no_module' | 'no_hardware' | 'not_enrolled';

export async function getLockAvailability(): Promise<{ available: boolean; reason?: LockUnavailableReason }> {
  const LA = getLA();
  if (!LA) return { available: false, reason: 'no_module' };
  try {
    if (!(await LA.hasHardwareAsync())) return { available: false, reason: 'no_hardware' };
    if (!(await LA.isEnrolledAsync()))  return { available: false, reason: 'not_enrolled' };
    return { available: true };
  } catch {
    return { available: false, reason: 'no_hardware' };
  }
}

export async function isHardwareAvailable(): Promise<boolean> {
  const LA = getLA();
  if (!LA) return false;
  try { return await LA.hasHardwareAsync(); } catch { return false; }
}

export async function isEnrolled(): Promise<boolean> {
  const LA = getLA();
  if (!LA) return false;
  try { return await LA.isEnrolledAsync(); } catch { return false; }
}

export async function getSupportedTypes(): Promise<AuthType[]> {
  const LA = getLA();
  if (!LA) return [];
  try {
    const types = await LA.supportedAuthenticationTypesAsync();
    const out: AuthType[] = [];
    for (const t of types) {
      if (t === LA.AuthenticationType.FACIAL_RECOGNITION) out.push('face');
      else if (t === LA.AuthenticationType.FINGERPRINT) out.push('fingerprint');
      else if (t === LA.AuthenticationType.IRIS) out.push('iris');
      else out.push('unknown');
    }
    return out;
  } catch { return []; }
}

/** Returns true on a successful biometric or device-passcode auth. */
export async function authenticate(promptMessage: string): Promise<boolean> {
  const LA = getLA();
  if (!LA) return false;
  try {
    const r = await LA.authenticateAsync({
      promptMessage,
      // disableDeviceFallback=false → on biometric failure the OS lets the user
      // fall back to the device passcode, so we don't need our own PIN.
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}
