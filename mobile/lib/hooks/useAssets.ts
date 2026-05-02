import { useState, useCallback, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { Asset } from '../models/Asset';
import type { HistoryPoint } from '../models/History';
import type { LivePrices } from '../models/PriceMap';
import {
  getAssets, addAsset, updateAsset, deleteAsset, getTotalWorth,
} from '../services/AssetService';
import { dbGetHistory } from '../repositories/HistoryRepository';

export interface UseAssetsResult {
  assets:     Asset[];
  history:    HistoryPoint[];
  totalWorth: number;
  loading:    boolean;
  reload:     () => Promise<void>;
  handleAdd:    (data: Omit<Asset, 'id' | 'createdAt'>) => Promise<void>;
  handleUpdate: (id: string, data: Partial<Omit<Asset, 'id' | 'createdAt'>>) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
}

export function useAssets(prices: Partial<LivePrices>): UseAssetsResult {
  const db = useSQLiteContext();
  const [assets, setAssets]   = useState<Asset[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [a, h] = await Promise.all([getAssets(db), dbGetHistory(db, 365)]);
    setAssets(a);
    setHistory(h);
    setLoading(false);
  }, [db]);

  useEffect(() => { reload(); }, [reload]);

  const handleAdd = useCallback(async (data: Omit<Asset, 'id' | 'createdAt'>) => {
    await addAsset(db, data, prices);
    await reload();
  }, [db, prices, reload]);

  const handleUpdate = useCallback(async (
    id: string,
    data: Partial<Omit<Asset, 'id' | 'createdAt'>>
  ) => {
    await updateAsset(db, id, data, prices);
    await reload();
  }, [db, prices, reload]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteAsset(db, id, prices);
    await reload();
  }, [db, prices, reload]);

  return {
    assets,
    history,
    totalWorth: getTotalWorth(assets, prices),
    loading,
    reload,
    handleAdd,
    handleUpdate,
    handleDelete,
  };
}
