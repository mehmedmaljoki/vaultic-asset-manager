import { adjustDebt, splitDebt } from '../../../lib/services/DebtService';
import type { Debt } from '../../../lib/models/Debt';

// Minimal SQLiteDatabase mock — only the methods used by DebtService
function makeMockDb(debt?: Debt) {
  const debts = debt ? [debt] : [];
  return {
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(async () => debts.map(d => ({
      id: d.id, direction: d.direction, name: d.name,
      amount: d.amount, note: d.note ?? null,
      people: JSON.stringify(d.people),
      created_at: d.createdAt, updated_at: d.updatedAt ?? null,
    }))),
    getFirstAsync: jest.fn(),
  } as unknown as import('expo-sqlite').SQLiteDatabase;
}

describe('adjustDebt', () => {
  it('clamps amount to 0 when delta makes it negative', async () => {
    const db = makeMockDb();
    await adjustDebt(db, 'id1', -9999, 'payment', 100);
    const call = (db.runAsync as jest.Mock).mock.calls.find(
      c => typeof c[0] === 'string' && c[0].includes('UPDATE')
    );
    expect(call).toBeDefined();
    expect(call![1][0]).toBe(0); // newAmount should be 0
  });

  it('increases amount correctly', async () => {
    const db = makeMockDb();
    await adjustDebt(db, 'id1', 200, 'more money', 500);
    const call = (db.runAsync as jest.Mock).mock.calls.find(
      c => typeof c[0] === 'string' && c[0].includes('UPDATE')
    );
    expect(call![1][0]).toBe(700);
  });
});

describe('splitDebt', () => {
  const baseDebt: Debt = {
    id: 'd1', direction: 'owed_to_me', name: 'Group Loan',
    amount: 300, people: ['Alice', 'Bob', 'Charlie'],
    transactions: [], createdAt: new Date().toISOString(),
  };

  it('splits evenly across people', async () => {
    const db = makeMockDb(baseDebt);
    const splits = await splitDebt(db, baseDebt);
    expect(splits).toHaveLength(3);
    splits.forEach(s => expect(s.amount).toBeCloseTo(100));
  });

  it('assigns correct person name to each split', async () => {
    const db = makeMockDb(baseDebt);
    const splits = await splitDebt(db, baseDebt);
    const names = splits.map(s => s.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
    expect(names).toContain('Charlie');
  });

  it('returns original debt unchanged when only 1 person', async () => {
    const single = { ...baseDebt, people: ['Alice'] };
    const db = makeMockDb(single);
    const result = await splitDebt(db, single);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(single.id);
  });
});
