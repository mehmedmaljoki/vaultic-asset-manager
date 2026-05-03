import { renderHook, act } from '@testing-library/react-native';
import { useAppLock } from '../../../lib/hooks/useAppLock';

jest.mock('../../../lib/services/LockService', () => ({
  authenticate: jest.fn(),
}));

const { authenticate } = require('../../../lib/services/LockService');

beforeEach(() => { jest.clearAllMocks(); });

describe('useAppLock', () => {
  it('starts unlocked when lockEnabled=false', () => {
    const { result } = renderHook(() => useAppLock(false));
    expect(result.current.locked).toBe(false);
  });

  it('starts locked when lockEnabled=true', () => {
    const { result } = renderHook(() => useAppLock(true));
    expect(result.current.locked).toBe(true);
  });

  it('unlocks on successful auth', async () => {
    authenticate.mockResolvedValue(true);
    const { result } = renderHook(() => useAppLock(true));
    await act(async () => { await result.current.unlock('reason'); });
    expect(result.current.locked).toBe(false);
    expect(authenticate).toHaveBeenCalledWith('reason');
  });

  it('stays locked on failed auth', async () => {
    authenticate.mockResolvedValue(false);
    const { result } = renderHook(() => useAppLock(true));
    await act(async () => { await result.current.unlock('reason'); });
    expect(result.current.locked).toBe(true);
  });
});
