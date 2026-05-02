export interface Asset {
  id: string;
  type: 'metals' | 'money' | 'real_estate' | 'vehicle' | 'crypto' | 'jewelry' | 'collectibles';
  subtype?: string;
  name: string;
  quantity?: number;
  unit?: string;
  value?: number;
  // ISO 4217 code (e.g. 'EUR'). Only meaningful for value-based types
  // (money/real_estate/vehicle/jewelry); metals & crypto are computed in settings currency.
  // Missing on legacy rows — treat as settings.currency.
  currency?: string;
  // Millesimal fineness for metals: 1000 = pure, 916 = 22k gold, 925 = sterling silver, etc.
  // Missing/undefined = treat as 1000 (pure). Only applied to type='metals'.
  purity?: number;
  purchasedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export function assetNeedsPrice(asset: Asset): boolean {
  return asset.type === 'metals' || asset.type === 'crypto';
}
