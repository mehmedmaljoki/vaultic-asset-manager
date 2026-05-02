import { useState, useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { fetchPrices, oldestPriceAgeMinutes, type PriceFetchResult } from '../services/PriceService';
import type { LivePrices } from '../models/PriceMap';
import type { Settings } from '../models/Settings';

export interface UsePricesResult {
  prices:    Partial<LivePrices>;
  source:    PriceFetchResult['source'] | null;
  ageMinutes: number | null;
  loading:   boolean;
  refresh:   () => Promise<void>;
}

export function usePrices(settings: Settings): UsePricesResult {
  const db = useSQLiteContext();
  const [result, setResult] = useState<PriceFetchResult | null>(null);
  const [loading, setLoading]  = useState(false);

  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetchPrices(db, settings.currency, settings.apiProvider);
      setResult(r);
    } catch {
      // keep previous result
    } finally {
      setLoading(false);
    }
  }, [db, settings.currency, settings.apiProvider, loading]);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.currency, settings.apiProvider]);

  // Reload when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  return {
    prices:     result?.prices    ?? {},
    source:     result?.source    ?? null,
    ageMinutes: result ? oldestPriceAgeMinutes(result.fetchedAt) : null,
    loading,
    refresh: load,
  };
}
