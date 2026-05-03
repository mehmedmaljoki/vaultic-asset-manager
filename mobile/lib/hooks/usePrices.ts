import { useState, useCallback, useEffect, useRef } from 'react';
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

export function usePrices(settings: Settings, dataVersion = 0): UsePricesResult {
  const db = useSQLiteContext();
  const [result, setResult] = useState<PriceFetchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const r = await fetchPrices(db, settings.currency, settings.apiProvider);
      setResult(r);
    } catch {
      // keep previous result
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [db, settings.currency, settings.apiProvider]);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.currency, settings.apiProvider, dataVersion]);

  // Reload when app comes back to foreground — stable listener (load ref is stable)
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
