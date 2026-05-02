import { useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import type { Asset } from '../models/Asset';
import type { LivePrices } from '../models/PriceMap';
import { computeZakat, type ZakatResult } from '../services/ZakatService';

export function useZakat(
  assets: Asset[],
  prices: Partial<LivePrices>,
  nisabType: 'silver' | 'gold',
  overrides: Partial<Record<Asset['type'], boolean>>
): ZakatResult {
  return useMemo(
    () => computeZakat(assets, prices, nisabType, overrides),
    [assets, prices, nisabType, overrides]
  );
}
