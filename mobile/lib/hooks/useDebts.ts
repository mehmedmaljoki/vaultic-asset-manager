import { useState, useCallback, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { Debt } from '../models/Debt';
import {
  getDebts, addDebt, adjustDebt, deleteDebt, splitDebt,
} from '../services/DebtService';
import { useApp } from '../AppContext';

export interface UseDebtsResult {
  debts:    Debt[];
  totOwed:  number;
  totIowe:  number;
  loading:  boolean;
  reload:   () => Promise<void>;
  handleAdd:    (data: Omit<Debt, 'id' | 'createdAt' | 'transactions'>) => Promise<void>;
  handleAdjust: (id: string, delta: number, note: string, currentAmount: number) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleSplit:  (debt: Debt) => Promise<void>;
}

export function useDebts(): UseDebtsResult {
  const db = useSQLiteContext();
  const { dataVersion, notifyDataChanged } = useApp();
  const [debts, setDebts]   = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setDebts(await getDebts(db));
    setLoading(false);
  }, [db]);

  useEffect(() => { reload(); }, [reload, dataVersion]);

  const handleAdd = useCallback(async (
    data: Omit<Debt, 'id' | 'createdAt' | 'transactions'>
  ) => {
    await addDebt(db, data);
    await notifyDataChanged();
  }, [db, notifyDataChanged]);

  const handleAdjust = useCallback(async (
    id: string, delta: number, note: string, currentAmount: number
  ) => {
    await adjustDebt(db, id, delta, note, currentAmount);
    await notifyDataChanged();
  }, [db, notifyDataChanged]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteDebt(db, id);
    await notifyDataChanged();
  }, [db, notifyDataChanged]);

  const handleSplit = useCallback(async (debt: Debt) => {
    await splitDebt(db, debt);
    await notifyDataChanged();
  }, [db, notifyDataChanged]);

  const totOwed = debts
    .filter(d => d.direction === 'owed_to_me')
    .reduce((s, d) => s + d.amount, 0);
  const totIowe = debts
    .filter(d => d.direction === 'i_owe')
    .reduce((s, d) => s + d.amount, 0);

  return { debts, totOwed, totIowe, loading, reload, handleAdd, handleAdjust, handleDelete, handleSplit };
}
