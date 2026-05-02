import { useState, useCallback, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { fetchFxRates, type FxFetchResult, type FxSource } from '../services/FxService';
import type { Settings } from '../models/Settings';

export interface UseFxRatesResult {
  rates:   Record<string, number>;
  source:  FxSource | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useFxRates(settings: Settings, dataVersion = 0): UseFxRatesResult {
  const db = useSQLiteContext();
  const [result, setResult]   = useState<FxFetchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetchFxRates(db, settings.currency);
      setResult(r);
    } catch {
      // keep previous result
    } finally {
      setLoading(false);
    }
  }, [db, settings.currency, loading]);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.currency, dataVersion]);

  return {
    rates:   result?.rates  ?? { [settings.currency]: 1 },
    source:  result?.source ?? null,
    loading,
    refresh: load,
  };
}
