import type { Asset } from '../models/Asset';
import type { LivePrices } from '../models/PriceMap';
import { NISAB_SILVER_G, NISAB_GOLD_G } from '../models/PriceMap';
import { calcValue } from './AssetService';

export const ZAKAT_RATE = 0.025;

export type ZakatableRule = 'zakatable' | 'not_zakatable';

export const ZAKAT_RULES: Record<Asset['type'], ZakatableRule> = {
  metals:       'zakatable',
  money:        'zakatable',
  crypto:       'zakatable',
  jewelry:      'zakatable',
  real_estate:  'not_zakatable',
  vehicle:      'not_zakatable',
  collectibles: 'not_zakatable',
};

export interface ZakatBreakdown {
  categoryId: Asset['type'];
  rule: ZakatableRule;
  isZakatable: boolean;
  total: number | null;
  zakatAmount: number | null;
}

export interface ZakatResult {
  nisabValue: number | null;
  totalWorth: number;
  zakatableTotal: number;
  zakatDue: number;
  aboveNisab: boolean;
  breakdown: ZakatBreakdown[];
}

export function computeZakat(
  assets: Asset[],
  prices: Partial<LivePrices>,
  nisabType: 'silver' | 'gold',
  overrides: Partial<Record<Asset['type'], boolean>>
): ZakatResult {
  const nisabGrams    = nisabType === 'silver' ? NISAB_SILVER_G : NISAB_GOLD_G;
  const nisabPriceKey = nisabType === 'silver' ? 'silver' : 'gold';
  const nisabUnitPrice = prices[nisabPriceKey] ?? null;
  const nisabValue     = nisabUnitPrice != null ? nisabGrams * nisabUnitPrice : null;

  const byCategory = new Map<Asset['type'], number | null>();

  for (const asset of assets) {
    const val = calcValue(asset, prices);
    const cur = byCategory.get(asset.type);
    if (val == null) {
      if (cur === undefined) byCategory.set(asset.type, null);
    } else {
      byCategory.set(asset.type, (cur ?? 0) + val);
    }
  }

  let totalWorth     = 0;
  let zakatableTotal = 0;
  const breakdown: ZakatBreakdown[] = [];

  for (const [type, total] of byCategory.entries()) {
    const baseRule   = ZAKAT_RULES[type];
    const isZakatable = overrides[type] !== undefined
      ? overrides[type]!
      : baseRule === 'zakatable';

    if (isZakatable && total != null) zakatableTotal += total;
    if (total != null) totalWorth += total;

    breakdown.push({
      categoryId:  type,
      rule:        baseRule,
      isZakatable,
      total,
      zakatAmount: isZakatable && total != null ? total * ZAKAT_RATE : null,
    });
  }

  const aboveNisab = nisabValue != null ? zakatableTotal >= nisabValue : false;
  const zakatDue   = aboveNisab ? zakatableTotal * ZAKAT_RATE : 0;

  return { nisabValue, totalWorth, zakatableTotal, zakatDue, aboveNisab, breakdown };
}
