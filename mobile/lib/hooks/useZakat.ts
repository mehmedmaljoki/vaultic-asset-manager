import { useMemo } from 'react';
import type { Asset } from '../models/Asset';
import type { Debt } from '../models/Debt';
import type { LivePrices } from '../models/PriceMap';
import { computeZakat, type ZakatResult, type ZakatCategoryId } from '../services/ZakatService';

export function useZakat(
  assets: Asset[],
  prices: Partial<LivePrices>,
  nisabType: 'silver' | 'gold',
  overrides: Partial<Record<ZakatCategoryId, boolean>>,
  fxRates: Record<string, number> = {},
  debts: Debt[] = [],
): ZakatResult {
  return useMemo(
    () => computeZakat(assets, prices, nisabType, overrides, fxRates, debts),
    [assets, prices, nisabType, overrides, fxRates, debts]
  );
}
