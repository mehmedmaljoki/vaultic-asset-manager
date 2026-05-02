import { renderHook, act } from '@testing-library/react-native';
import { useAssets } from '../../../lib/hooks/useAssets';
import { mockDb } from '../../../__mocks__/expo-sqlite';

jest.mock('expo-sqlite');
jest.mock('../../../lib/services/AssetService');
jest.mock('../../../lib/repositories/HistoryRepository');

const AssetService = require('../../../lib/services/AssetService');
const { dbGetHistory } = require('../../../lib/repositories/HistoryRepository');

const mockAsset = {
  id: 'a1', type: 'money' as const, name: 'Cash', value: 1000, createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  AssetService.getAssets.mockResolvedValue([]);
  AssetService.getTotalWorth.mockReturnValue(0);
  dbGetHistory.mockResolvedValue([]);
});

describe('useAssets', () => {
  it('starts in loading state then loads assets and history', async () => {
    AssetService.getAssets.mockResolvedValue([mockAsset]);
    const { result } = renderHook(() => useAssets({}));
    expect(result.current.loading).toBe(true);
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.assets).toEqual([mockAsset]);
    expect(AssetService.getAssets).toHaveBeenCalledWith(mockDb);
    expect(dbGetHistory).toHaveBeenCalledWith(mockDb, 365);
  });

  it('totalWorth delegates to getTotalWorth service', async () => {
    AssetService.getAssets.mockResolvedValue([mockAsset]);
    AssetService.getTotalWorth.mockReturnValue(1000);
    const { result } = renderHook(() => useAssets({}));
    await act(async () => {});
    expect(AssetService.getTotalWorth).toHaveBeenCalledWith([mockAsset], {});
    expect(result.current.totalWorth).toBe(1000);
  });

  it('handleAdd calls addAsset with prices then reloads', async () => {
    AssetService.addAsset.mockResolvedValue(undefined);
    const prices = { gold: 90 };
    const { result } = renderHook(() => useAssets(prices));
    await act(async () => {});

    await act(async () => {
      await result.current.handleAdd({ type: 'money', name: 'Savings', value: 500 });
    });

    expect(AssetService.addAsset).toHaveBeenCalledWith(
      mockDb, { type: 'money', name: 'Savings', value: 500 }, prices
    );
    expect(AssetService.getAssets).toHaveBeenCalledTimes(2);
  });

  it('handleUpdate calls updateAsset with prices then reloads', async () => {
    AssetService.updateAsset.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAssets({}));
    await act(async () => {});

    await act(async () => {
      await result.current.handleUpdate('a1', { name: 'Updated' });
    });

    expect(AssetService.updateAsset).toHaveBeenCalledWith(mockDb, 'a1', { name: 'Updated' }, {});
    expect(AssetService.getAssets).toHaveBeenCalledTimes(2);
  });

  it('handleDelete calls deleteAsset then reloads', async () => {
    AssetService.deleteAsset.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAssets({}));
    await act(async () => {});

    await act(async () => {
      await result.current.handleDelete('a1');
    });

    expect(AssetService.deleteAsset).toHaveBeenCalledWith(mockDb, 'a1', {});
    expect(AssetService.getAssets).toHaveBeenCalledTimes(2);
  });
});
