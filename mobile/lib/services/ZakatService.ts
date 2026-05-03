import type { Asset } from '../models/Asset';
import type { Debt } from '../models/Debt';
import type { LivePrices } from '../models/PriceMap';
import { NISAB_SILVER_G, NISAB_GOLD_G } from '../models/PriceMap';
import { calcValue } from './AssetService';

export const ZAKAT_RATE = 0.025;
export const HAWL_DAYS = 354.367;          // Islamic lunar year
export const HAWL_MS   = HAWL_DAYS * 86_400_000;

export type ZakatableRule  = 'zakatable' | 'not_zakatable';
export type ZakatCategoryId = Asset['type'] | 'receivables';

export const ZAKAT_RULES: Record<ZakatCategoryId, ZakatableRule> = {
  metals:       'zakatable',
  money:        'zakatable',
  crypto:       'zakatable',
  jewelry:      'zakatable',
  real_estate:  'not_zakatable',
  vehicle:      'not_zakatable',
  collectibles: 'not_zakatable',
  receivables:  'not_zakatable',
};

/** Returns the date used for hawl: purchasedAt if present, else createdAt. */
export function hawlAcquisitionDate(asset: Asset): string | undefined {
  return asset.purchasedAt ?? asset.createdAt ?? undefined;
}

export function hasHawlPassed(asset: Asset, asOfMs: number): boolean {
  const dateStr = hawlAcquisitionDate(asset);
  if (!dateStr) return false;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return false;
  return (asOfMs - t) >= HAWL_MS;
}

export interface ZakatBreakdown {
  categoryId: ZakatCategoryId;
  rule: ZakatableRule;
  isZakatable: boolean;
  /** Value of hawl-met assets in this category (null = no price info available). */
  total: number | null;
  /** Value of hawl-pending assets in this category. */
  pendingTotal: number;
  hawlMet: number;
  hawlTotal: number;
  /** How many assets relied on `createdAt` because `purchasedAt` was missing. */
  usedCreatedAtCount: number;
  zakatAmount: number | null;
}

/** One line in the receipt: a single asset that contributed to zakatableTotal. */
export interface ZakatLineItem {
  assetId: string;
  assetName: string;
  categoryId: ZakatCategoryId;
  value: number;
  zakatAmount: number;
  acquiredAt: string;
  usedCreatedAtFallback: boolean;
}

export interface ZakatResult {
  nisabValue: number | null;
  totalWorth: number;          // hawl-met sum
  zakatableTotal: number;      // hawl-met & zakatable
  pendingTotal: number;        // hawl-pending sum (any category)
  zakatDue: number;
  aboveNisab: boolean;
  breakdown: ZakatBreakdown[];
  /** Individual assets/debts that contributed to zakatableTotal, sorted by value desc. */
  lineItems: ZakatLineItem[];
  /** ISO of the "now" anchor used for the hawl computation. */
  hawlAsOf: string;
  /** Earliest acquisition date among hawl-met assets (window start). */
  hawlEarliestUsed: string | undefined;
  /** Total count of assets where createdAt was substituted for purchasedAt. */
  usedCreatedAtCount: number;
}

interface CatAgg {
  metTotal: number;
  hasNumeric: boolean;
  pendingTotal: number;
  hawlMet: number;
  hawlTotal: number;
  usedCreatedAtCount: number;
}

export function computeZakat(
  assets: Asset[],
  prices: Partial<LivePrices>,
  nisabType: 'silver' | 'gold',
  overrides: Partial<Record<ZakatCategoryId, boolean>>,
  fxRates: Record<string, number> = {},
  debts: Debt[] = [],
  asOfDate: Date = new Date(),
): ZakatResult {
  const nisabGrams     = nisabType === 'silver' ? NISAB_SILVER_G : NISAB_GOLD_G;
  const nisabPriceKey  = nisabType === 'silver' ? 'silver' : 'gold';
  const nisabUnitPrice = prices[nisabPriceKey] ?? null;
  const nisabValue     = nisabUnitPrice != null ? nisabGrams * nisabUnitPrice : null;

  const asOfMs  = asOfDate.getTime();
  const asOfIso = asOfDate.toISOString();

  const byCategory = new Map<ZakatCategoryId, CatAgg>();
  function ensure(id: ZakatCategoryId): CatAgg {
    let a = byCategory.get(id);
    if (!a) {
      a = { metTotal: 0, hasNumeric: false, pendingTotal: 0, hawlMet: 0, hawlTotal: 0, usedCreatedAtCount: 0 };
      byCategory.set(id, a);
    }
    return a;
  }

  let totalUsedCreatedAt = 0;
  let earliestMetMs = Infinity;
  const lineItems: ZakatLineItem[] = [];

  for (const asset of assets) {
    const agg = ensure(asset.type);
    agg.hawlTotal++;
    const usedFallback = !asset.purchasedAt && !!asset.createdAt;
    if (usedFallback) {
      agg.usedCreatedAtCount++;
      totalUsedCreatedAt++;
    }

    const val    = calcValue(asset, prices, fxRates);
    const passed = hasHawlPassed(asset, asOfMs);

    if (passed) {
      agg.hawlMet++;
      if (val != null) {
        agg.hasNumeric = true;
        agg.metTotal += val;
        const effectiveZakatable = overrides[asset.type] !== undefined
          ? overrides[asset.type]!
          : ZAKAT_RULES[asset.type] === 'zakatable';
        if (effectiveZakatable) {
          lineItems.push({
            assetId: asset.id,
            assetName: asset.name,
            categoryId: asset.type,
            value: val,
            zakatAmount: val * ZAKAT_RATE,
            acquiredAt: hawlAcquisitionDate(asset) ?? asOfIso,
            usedCreatedAtFallback: usedFallback,
          });
        }
      }
      const dateStr = hawlAcquisitionDate(asset);
      if (dateStr) {
        const t = Date.parse(dateStr);
        if (!Number.isNaN(t) && t < earliestMetMs) earliestMetMs = t;
      }
    } else if (val != null) {
      agg.pendingTotal += val;
    }
  }

  // Receivables: aggregate "owed_to_me" debts into a synthetic category.
  // Hawl is not strictly applied per individual debt (the user is the one
  // tracking it, not the borrower). Treat as held — toggle via override.
  const owedToMe = debts.filter(d => d.direction === 'owed_to_me');
  if (owedToMe.length > 0) {
    const agg = ensure('receivables');
    agg.hawlTotal = owedToMe.length;
    agg.hawlMet   = owedToMe.length;
    const sum = owedToMe.reduce((s, d) => s + (d.amount ?? 0), 0);
    agg.metTotal   += sum;
    agg.hasNumeric  = true;
    const recvZakatable = overrides['receivables'] !== undefined
      ? overrides['receivables']!
      : ZAKAT_RULES['receivables'] === 'zakatable';
    if (recvZakatable && sum > 0) {
      lineItems.push({
        assetId:              'receivables',
        assetName:            'Receivables',
        categoryId:           'receivables',
        value:                sum,
        zakatAmount:          sum * ZAKAT_RATE,
        acquiredAt:           asOfIso,
        usedCreatedAtFallback: false,
      });
    }
  }

  let totalWorth     = 0;
  let zakatableTotal = 0;
  let pendingTotal   = 0;
  const breakdown: ZakatBreakdown[] = [];

  for (const [type, agg] of byCategory.entries()) {
    const baseRule    = ZAKAT_RULES[type];
    const isZakatable = overrides[type] !== undefined ? overrides[type]! : baseRule === 'zakatable';
    const total: number | null = agg.hasNumeric ? agg.metTotal : (agg.hawlMet > 0 ? null : 0);

    if (total != null) totalWorth += total;
    if (isZakatable && total != null) zakatableTotal += total;
    pendingTotal += agg.pendingTotal;

    breakdown.push({
      categoryId: type,
      rule: baseRule,
      isZakatable,
      total,
      pendingTotal: agg.pendingTotal,
      hawlMet: agg.hawlMet,
      hawlTotal: agg.hawlTotal,
      usedCreatedAtCount: agg.usedCreatedAtCount,
      zakatAmount: isZakatable && total != null ? total * ZAKAT_RATE : null,
    });
  }

  const aboveNisab = nisabValue != null ? zakatableTotal >= nisabValue : false;
  const zakatDue   = aboveNisab ? zakatableTotal * ZAKAT_RATE : 0;
  const hawlEarliestUsed = earliestMetMs !== Infinity ? new Date(earliestMetMs).toISOString() : undefined;

  // Re-compute zakatAmount for each line item based on final overrides
  // (overrides may flip isZakatable after asset loop — re-filter to keep consistent)
  const finalLineItems = lineItems
    .filter(item => {
      const cat = item.categoryId;
      const isZ = overrides[cat] !== undefined ? overrides[cat]! : ZAKAT_RULES[cat] === 'zakatable';
      return isZ;
    })
    .sort((a, b) => b.value - a.value);

  return {
    nisabValue, totalWorth, zakatableTotal, pendingTotal, zakatDue, aboveNisab, breakdown,
    lineItems: finalLineItems,
    hawlAsOf: asOfIso, hawlEarliestUsed, usedCreatedAtCount: totalUsedCreatedAt,
  };
}
