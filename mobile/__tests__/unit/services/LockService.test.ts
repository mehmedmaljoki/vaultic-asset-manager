// Simulate hardware not enrolled so every exported helper returns a safe falsy value.
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync:                    async () => false,
  isEnrolledAsync:                     async () => false,
  supportedAuthenticationTypesAsync:   async () => [],
  authenticateAsync:                   async () => ({ success: false }),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

import {
  authenticate, getLockAvailability, getSupportedTypes,
  isEnrolled, isHardwareAvailable,
} from '../../../lib/services/LockService';

describe('LockService (hardware absent / not enrolled)', () => {
  it('returns safe defaults when hardware is unavailable', async () => {
    expect(await isHardwareAvailable()).toBe(false);
    expect(await isEnrolled()).toBe(false);
    expect(await getSupportedTypes()).toEqual([]);
    expect(await authenticate('Unlock')).toBe(false);
  });

  it('getLockAvailability reports no_hardware', async () => {
    const result = await getLockAvailability();
    expect(result.available).toBe(false);
    expect(result.reason).toBe('no_hardware');
  });
});
