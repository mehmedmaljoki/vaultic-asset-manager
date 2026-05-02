import { renderHook, act } from '@testing-library/react-native';
import { useDebts } from '../../../lib/hooks/useDebts';
import { mockDb } from '../../../__mocks__/expo-sqlite';
import type { Debt } from '../../../lib/models/Debt';

jest.mock('expo-sqlite');
jest.mock('../../../lib/services/DebtService');
const mockNotify = jest.fn();
jest.mock('../../../lib/AppContext', () => ({
  useApp: () => ({ dataVersion: 0, notifyDataChanged: mockNotify }),
}));

const DebtService = require('../../../lib/services/DebtService');

const makeDebt = (overrides: Partial<Debt>): Debt => ({
  id: 'd1', direction: 'owed_to_me', name: 'Ali', amount: 500,
  people: ['Ali'], transactions: [], createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  DebtService.getDebts.mockResolvedValue([]);
});

describe('useDebts', () => {
  it('starts in loading state then loads debts', async () => {
    const debts = [makeDebt({})];
    DebtService.getDebts.mockResolvedValue(debts);
    const { result } = renderHook(() => useDebts());
    expect(result.current.loading).toBe(true);
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(result.current.debts).toEqual(debts);
    expect(DebtService.getDebts).toHaveBeenCalledWith(mockDb);
  });

  it('computes totOwed and totIowe from debt directions', async () => {
    DebtService.getDebts.mockResolvedValue([
      makeDebt({ id: 'd1', direction: 'owed_to_me', amount: 500 }),
      makeDebt({ id: 'd2', direction: 'owed_to_me', amount: 200 }),
      makeDebt({ id: 'd3', direction: 'i_owe',      amount: 3500 }),
    ]);
    const { result } = renderHook(() => useDebts());
    await act(async () => {});
    expect(result.current.totOwed).toBe(700);
    expect(result.current.totIowe).toBe(3500);
  });

  it('handleAdd calls addDebt then reloads', async () => {
    DebtService.addDebt.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDebts());
    await act(async () => {});

    await act(async () => {
      await result.current.handleAdd({
        direction: 'owed_to_me', name: 'Sara', amount: 200, people: ['Sara'],
      });
    });

    expect(DebtService.addDebt).toHaveBeenCalledWith(
      mockDb, { direction: 'owed_to_me', name: 'Sara', amount: 200, people: ['Sara'] }
    );
    expect(mockNotify).toHaveBeenCalled();
  });

  it('handleAdjust calls adjustDebt then reloads', async () => {
    DebtService.adjustDebt.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDebts());
    await act(async () => {});

    await act(async () => {
      await result.current.handleAdjust('d1', -100, 'partial payment', 500);
    });

    expect(DebtService.adjustDebt).toHaveBeenCalledWith(mockDb, 'd1', -100, 'partial payment', 500);
    expect(mockNotify).toHaveBeenCalled();
  });

  it('handleDelete calls deleteDebt then reloads', async () => {
    DebtService.deleteDebt.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDebts());
    await act(async () => {});

    await act(async () => {
      await result.current.handleDelete('d1');
    });

    expect(DebtService.deleteDebt).toHaveBeenCalledWith(mockDb, 'd1');
    expect(mockNotify).toHaveBeenCalled();
  });

  it('handleSplit calls splitDebt then reloads', async () => {
    DebtService.splitDebt.mockResolvedValue(undefined);
    const debt = makeDebt({ people: ['Ali', 'Sara'] });
    const { result } = renderHook(() => useDebts());
    await act(async () => {});

    await act(async () => {
      await result.current.handleSplit(debt);
    });

    expect(DebtService.splitDebt).toHaveBeenCalledWith(mockDb, debt);
    expect(mockNotify).toHaveBeenCalled();
  });
});
