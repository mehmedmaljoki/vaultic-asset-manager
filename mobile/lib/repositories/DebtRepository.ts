import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import type { Debt, DebtTransaction } from '../models/Debt';

function rowToDebt(row: Record<string, unknown>, txs: DebtTransaction[]): Debt {
  return {
    id:         row.id as string,
    direction:  row.direction as Debt['direction'],
    name:       row.name as string,
    amount:     row.amount as number,
    note:       (row.note as string) ?? undefined,
    people:     JSON.parse((row.people as string) ?? '[]'),
    transactions: txs,
    createdAt:  row.created_at as string,
    updatedAt:  (row.updated_at as string) ?? undefined,
  };
}

async function getTxsForDebt(db: SQLiteDatabase, debtId: string): Promise<DebtTransaction[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLES.DEBT_TRANSACTIONS} WHERE debt_id=? ORDER BY date ASC`,
    [debtId]
  );
  return rows.map(r => ({
    id:     r.id as string,
    amount: r.amount as number,
    date:   r.date as string,
    note:   (r.note as string) ?? '',
  }));
}

export async function dbGetDebts(db: SQLiteDatabase): Promise<Debt[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLES.DEBTS} ORDER BY created_at DESC`
  );
  return Promise.all(rows.map(async r => rowToDebt(r, await getTxsForDebt(db, r.id as string))));
}

export async function dbAddDebt(db: SQLiteDatabase, debt: Debt): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO ${TABLES.DEBTS}
       (id, direction, name, amount, note, people, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [debt.id, debt.direction, debt.name, debt.amount, debt.note ?? null,
       JSON.stringify(debt.people), debt.createdAt, debt.updatedAt ?? null]
    );
    for (const tx of debt.transactions) {
      await db.runAsync(
        `INSERT INTO ${TABLES.DEBT_TRANSACTIONS} (id, debt_id, amount, date, note) VALUES (?,?,?,?,?)`,
        [tx.id, debt.id, tx.amount, tx.date, tx.note]
      );
    }
  });
}

export async function dbAdjustDebt(
  db: SQLiteDatabase,
  id: string,
  newAmount: number,
  tx: DebtTransaction,
  updatedAt: string
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE ${TABLES.DEBTS} SET amount=?, updated_at=? WHERE id=?`,
      [newAmount, updatedAt, id]
    );
    await db.runAsync(
      `INSERT INTO ${TABLES.DEBT_TRANSACTIONS} (id, debt_id, amount, date, note) VALUES (?,?,?,?,?)`,
      [tx.id, id, tx.amount, tx.date, tx.note]
    );
  });
}

export async function dbDeleteDebt(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM ${TABLES.DEBTS} WHERE id=?`, [id]);
}

export async function dbSplitDebt(
  db: SQLiteDatabase,
  originalId: string,
  splits: Debt[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const debt of splits) {
      await db.runAsync(
        `INSERT INTO ${TABLES.DEBTS}
         (id, direction, name, amount, note, people, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [debt.id, debt.direction, debt.name, debt.amount, debt.note ?? null,
         JSON.stringify(debt.people), debt.createdAt, debt.updatedAt ?? null]
      );
      for (const tx of debt.transactions) {
        await db.runAsync(
          `INSERT INTO ${TABLES.DEBT_TRANSACTIONS} (id, debt_id, amount, date, note) VALUES (?,?,?,?,?)`,
          [tx.id, debt.id, tx.amount, tx.date, tx.note]
        );
      }
    }
    await db.runAsync(`DELETE FROM ${TABLES.DEBTS} WHERE id=?`, [originalId]);
  });
}

export async function dbUpsertDebt(db: SQLiteDatabase, debt: Debt): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO ${TABLES.DEBTS}
       (id, direction, name, amount, note, people, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         direction=excluded.direction,
         name=excluded.name,
         amount=excluded.amount,
         note=excluded.note,
         people=excluded.people,
         updated_at=excluded.updated_at`,
      [debt.id, debt.direction, debt.name, debt.amount, debt.note ?? null,
       JSON.stringify(debt.people), debt.createdAt, debt.updatedAt ?? null]
    );
    // Replace child transactions wholesale — debt_transactions has no business
    // identity beyond the parent debt. CASCADE on debt_id makes this clean.
    await db.runAsync(`DELETE FROM ${TABLES.DEBT_TRANSACTIONS} WHERE debt_id=?`, [debt.id]);
    for (const tx of debt.transactions) {
      await db.runAsync(
        `INSERT INTO ${TABLES.DEBT_TRANSACTIONS} (id, debt_id, amount, date, note) VALUES (?,?,?,?,?)`,
        [tx.id, debt.id, tx.amount, tx.date, tx.note]
      );
    }
  });
}
