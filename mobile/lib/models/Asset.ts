export interface Asset {
  id: string;
  type: 'metals' | 'money' | 'real_estate' | 'vehicle' | 'crypto' | 'jewelry' | 'collectibles';
  subtype?: string;
  name: string;
  quantity?: number;
  unit?: string;
  value?: number;
  purchasedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export function assetNeedsPrice(asset: Asset): boolean {
  return asset.type === 'metals' || asset.type === 'crypto';
}
