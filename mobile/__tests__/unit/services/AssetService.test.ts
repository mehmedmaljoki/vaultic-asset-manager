import { calcValue, getTotalWorth } from '../../../lib/services/AssetService';
import type { Asset } from '../../../lib/models/Asset';
import type { LivePrices } from '../../../lib/models/PriceMap';

const PRICES: LivePrices = {
  gold: 100, silver: 2, platinum: 50, palladium: 40,
  bitcoin: 50000, ethereum: 3000, solana: 150, bnb: 400,
};

describe('calcValue', () => {
  it('returns quantity * price for metals (per gram)', () => {
    const asset: Asset = { id: '1', type: 'metals', subtype: 'gold', name: 'Gold', quantity: 10, createdAt: '' };
    expect(calcValue(asset, PRICES)).toBeCloseTo(1000);
  });

  it('returns quantity * price for crypto', () => {
    const asset: Asset = { id: '2', type: 'crypto', subtype: 'bitcoin', name: 'BTC', quantity: 0.5, createdAt: '' };
    expect(calcValue(asset, PRICES)).toBeCloseTo(25000);
  });

  it('returns asset.value for money (ignores prices)', () => {
    const asset: Asset = { id: '3', type: 'money', name: 'Cash', value: 5000, createdAt: '' };
    expect(calcValue(asset, {})).toBe(5000);
  });

  it('returns null when metal price is unavailable', () => {
    const asset: Asset = { id: '4', type: 'metals', subtype: 'gold', name: 'Gold', quantity: 10, createdAt: '' };
    expect(calcValue(asset, {})).toBeNull();
  });

  it('returns null for crypto with no price', () => {
    const asset: Asset = { id: '5', type: 'crypto', subtype: 'bitcoin', name: 'BTC', quantity: 1, createdAt: '' };
    expect(calcValue(asset, { gold: 100 })).toBeNull();
  });

  it('returns null when subtype is missing for a metal asset', () => {
    const asset: Asset = { id: '6', type: 'metals', name: 'Unknown Metal', quantity: 5, createdAt: '' };
    expect(calcValue(asset, PRICES)).toBeNull();
  });

  it('multiplies by gramsPerUnit for coin-type metals (pieces × gross weight × price × purity)', () => {
    // 5 Çeyrek: 1.754 g gross, 916 fineness, gold = 100/g (PRICES.gold)
    const asset: Asset = {
      id: '7', type: 'metals', subtype: 'gold', name: 'Çeyrek',
      quantity: 5, purity: 916, gramsPerUnit: 1.754, createdAt: '',
    };
    expect(calcValue(asset, PRICES)).toBeCloseTo(5 * 1.754 * 100 * 0.916);
  });

  it('treats missing gramsPerUnit as 1 (bars unaffected)', () => {
    const asset: Asset = {
      id: '8', type: 'metals', subtype: 'gold', name: 'Gold bar',
      quantity: 10, purity: 916, createdAt: '',
    };
    expect(calcValue(asset, PRICES)).toBeCloseTo(10 * 100 * 0.916);
  });
});

describe('getTotalWorth', () => {
  it('sums all valued assets and skips null-priced ones', () => {
    const assets: Asset[] = [
      { id: '1', type: 'money',  name: 'Cash',    value: 1000, createdAt: '' },
      { id: '2', type: 'crypto', subtype: 'bitcoin', name: 'BTC', quantity: 0.1, createdAt: '' },
      { id: '3', type: 'metals', subtype: 'gold', name: 'Gold', quantity: 10, createdAt: '' },
    ];
    // crypto and metals have prices, money does not need them
    const total = getTotalWorth(assets, PRICES);
    expect(total).toBeCloseTo(1000 + 5000 + 1000);
  });

  it('skips assets with null calcValue', () => {
    const assets: Asset[] = [
      { id: '1', type: 'money',  name: 'Cash', value: 500, createdAt: '' },
      { id: '2', type: 'crypto', subtype: 'bitcoin', name: 'BTC', quantity: 1, createdAt: '' },
    ];
    // No crypto prices — only money counts
    expect(getTotalWorth(assets, {})).toBe(500);
  });
});
