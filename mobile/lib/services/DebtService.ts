import type { SQLiteDatabase } from 'expo-sqlite';
import type { Debt, DebtTransaction } from '../models/Debt';
import {
  dbGetDebts, dbAddDebt, dbAdjustDebt, dbDeleteDebt,
} from '../repositories/DebtRepository';

export async function getDebts(db: SQLiteDatabase): Promise<Debt[]> {
  return dbGetDebts(db);
}

export async function addDebt(
  db: SQLiteDatabase,
  data: Omit<Debt, 'id' | 'createdAt' | 'transactions'>
): Promise<Debt> {
  const now = new Date().toISOString();
  const debt: Debt = {
    ...data,
    id:           Date.now().toString(),
    createdAt:    now,
    transactions: [{
      id:     `${Date.now()}_init`,
      amount: data.amount,
      date:   now,
      note:   'Initial amount',
    }],
  };
  await dbAddDebt(db, debt);
  return debt;
}

export async function adjustDebt(
  db: SQLiteDatabase,
  id: string,
  delta: number,
  note: string,
  currentAmount: number
): Promise<void> {
  const newAmount = Math.max(0, currentAmount + delta);
  const now = new Date().toISOString();
  const tx: DebtTransaction = {
    id:     Date.now().toString(),
    amount: delta,
    date:   now,
    note,
  };
  await dbAdjustDebt(db, id, newAmount, tx, now);
}

export async function deleteDebt(db: SQLiteDatabase, id: string): Promise<void> {
  await dbDeleteDebt(db, id);
}

/** Split a debt evenly across people, creating one sub-debt per person. */
export async function splitDebt(
  db: SQLiteDatabase,
  debt: Debt
): Promise<Debt[]> {
  if (!debt.people || debt.people.length <= 1) return [debt];

  const share = parseFloat((debt.amount / debt.people.length).toFixed(2));
  const splits: Debt[] = [];
  let i = 0;
  for (const person of debt.people) {
    const now = new Date().toISOString();
    const d: Debt = {
      id:        `${Date.now()}_${i++}`,
      direction: debt.direction,
      name:      person,
      amount:    share,
      note:      `Split from: ${debt.name}`,
      people:    [person],
      createdAt: now,
      transactions: [{
        id:     `${Date.now()}_${i}_init`,
        amount: share,
        date:   now,
        note:   `Split from ${debt.name}`,
      }],
    };
    await dbAddDebt(db, d);
    splits.push(d);
  }
  await dbDeleteDebt(db, debt.id);
  return splits;
}
