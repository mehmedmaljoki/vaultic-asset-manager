import { authenticate, getSupportedTypes, isEnrolled, isHardwareAvailable } from '../../../lib/services/LockService';

describe('LockService (no expo-local-authentication installed)', () => {
  it('reports unavailable when the native module is missing', async () => {
    expect(await isHardwareAvailable()).toBe(false);
    expect(await isEnrolled()).toBe(false);
    expect(await getSupportedTypes()).toEqual([]);
    expect(await authenticate('Unlock')).toBe(false);
  });
});
