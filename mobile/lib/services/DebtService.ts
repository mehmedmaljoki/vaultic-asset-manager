import type { SQLiteDatabase } from 'expo-sqlite';
import type { Debt, DebtTransaction } from '../models/Debt';
import {
  dbGetDebts, dbAddDebt, dbAdjustDebt, dbDeleteDebt, dbSplitDebt,
} from '../repositories/DebtRepository';

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

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
    id:           uid(),
    createdAt:    now,
    transactions: [{
      id:     uid(),
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
    id:     uid(),
    amount: delta,
    date:   now,
    note,
  };
  await dbAdjustDebt(db, id, newAmount, tx, now);
}

export async function deleteDebt(db: SQLiteDatabase, id: string): Promise<void> {
  await dbDeleteDebt(db, id);
}

/** Split a debt evenly across people, creating one sub-debt per person (atomic). */
export async function splitDebt(
  db: SQLiteDatabase,
  debt: Debt
): Promise<Debt[]> {
  if (!debt.people || debt.people.length <= 1) return [debt];

  const share = parseFloat((debt.amount / debt.people.length).toFixed(2));
  const now = new Date().toISOString();
  const splits: Debt[] = debt.people.map(person => ({
    id:        uid(),
    direction: debt.direction,
    name:      person,
    amount:    share,
    note:      `Split from: ${debt.name}`,
    people:    [person],
    createdAt: now,
    transactions: [{
      id:     uid(),
      amount: share,
      date:   now,
      note:   `Split from ${debt.name}`,
    }],
  }));
  await dbSplitDebt(db, debt.id, splits);
  return splits;
}
