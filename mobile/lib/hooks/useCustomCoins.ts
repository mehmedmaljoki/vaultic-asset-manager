import { useState, useEffect, useCallback } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { CustomCoin } from '../models/CustomCoin';
import { dbGetCustomCoins, dbAddCustomCoin } from '../repositories/CustomCoinRepository';

export interface UseCustomCoinsResult {
  customCoins: CustomCoin[];
  addCustomCoin: (coin: CustomCoin) => Promise<void>;
}

export function useCustomCoins(): UseCustomCoinsResult {
  const db = useSQLiteContext();
  const [customCoins, setCustomCoins] = useState<CustomCoin[]>([]);

  const reload = useCallback(async () => {
    try { setCustomCoins(await dbGetCustomCoins(db)); } catch { /* ignore */ }
  }, [db]);

  useEffect(() => { reload(); }, [reload]);

  const addCustomCoin = useCallback(async (coin: CustomCoin) => {
    await dbAddCustomCoin(db, coin);
    await reload();
  }, [db, reload]);

  return { customCoins, addCustomCoin };
}
