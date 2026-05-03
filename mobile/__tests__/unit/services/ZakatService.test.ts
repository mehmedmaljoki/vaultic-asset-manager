import { computeZakat, hasHawlPassed, ZAKAT_RATE } from '../../../lib/services/ZakatService';
import type { Asset } from '../../../lib/models/Asset';
import type { Debt } from '../../../lib/models/Debt';
import type { LivePrices } from '../../../lib/models/PriceMap';

const PRICES: LivePrices = {
  gold: 126.79,  // ~€3936/oz / 31.1035
  silver: 1.03,
  platinum: 30, palladium: 35,
  bitcoin: 52000, ethereum: 2800, solana: 140, bnb: 380,
};

// Two years ago, well past one lunar year so hawl is always met.
const OLD_CREATED_AT = new Date(Date.now() - 730 * 86_400_000).toISOString();

const makeAsset = (type: Asset['type'], value: number, subtype?: string): Asset => ({
  id: Math.random().toString(),
  type, subtype, name: type,
  value: type === 'money' || type === 'real_estate' || type === 'vehicle' || type === 'jewelry' || type === 'collectibles' ? value : undefined,
  quantity: type === 'metals' || type === 'crypto' ? value : undefined,
  unit: 'g',
  createdAt: OLD_CREATED_AT,
});

describe('computeZakat', () => {
  it('returns zakatDue 0 when total is below silver nisab', () => {
    const assets = [makeAsset('money', 100)];
    const result = computeZakat(assets, PRICES, 'silver', {});
    expect(result.aboveNisab).toBe(false);
    expect(result.zakatDue).toBe(0);
  });

  it('calculates 2.5% on zakatable wealth above silver nisab', () => {
    const assets = [makeAsset('money', 50000)];
    const result = computeZakat(assets, PRICES, 'silver', {});
    expect(result.aboveNisab).toBe(true);
    expect(result.zakatDue).toBeCloseTo(50000 * ZAKAT_RATE);
  });

  it('excludes real_estate from zakatable total by default', () => {
    const assets = [
      makeAsset('money', 50000),
      makeAsset('real_estate', 200000),
    ];
    const result = computeZakat(assets, PRICES, 'silver', {});
    expect(result.zakatableTotal).toBeCloseTo(50000);
  });

  it('honors override to make real_estate zakatable', () => {
    const assets = [makeAsset('real_estate', 200000)];
    const result = computeZakat(assets, PRICES, 'silver', { real_estate: true });
    expect(result.zakatableTotal).toBeCloseTo(200000);
  });

  it('excludes assets with null calcValue from zakatable total', () => {
    const cryptoAsset: Asset = { id: '1', type: 'crypto', subtype: 'bitcoin', name: 'BTC', quantity: 1, createdAt: OLD_CREATED_AT };
    const result = computeZakat([cryptoAsset], {}, 'silver', {});
    // No crypto price → null → not included
    expect(result.zakatableTotal).toBe(0);
    expect(result.zakatDue).toBe(0);
  });

  it('nisabValue is null when metal price unavailable', () => {
    const assets = [makeAsset('money', 50000)];
    const result = computeZakat(assets, {}, 'silver', {});
    expect(result.nisabValue).toBeNull();
    expect(result.aboveNisab).toBe(false);
  });
});

describe('hasHawlPassed', () => {
  const now = Date.now();
  it('true when purchasedAt is more than one lunar year old', () => {
    const a: Asset = { id: '1', type: 'money', name: 'x', value: 1, createdAt: '', purchasedAt: new Date(now - 400 * 86_400_000).toISOString() };
    expect(hasHawlPassed(a, now)).toBe(true);
  });
  it('false when purchasedAt is recent', () => {
    const a: Asset = { id: '1', type: 'money', name: 'x', value: 1, createdAt: '', purchasedAt: new Date(now - 30 * 86_400_000).toISOString() };
    expect(hasHawlPassed(a, now)).toBe(false);
  });
  it('falls back to createdAt when purchasedAt is missing', () => {
    const a: Asset = { id: '1', type: 'money', name: 'x', value: 1, createdAt: new Date(now - 400 * 86_400_000).toISOString() };
    expect(hasHawlPassed(a, now)).toBe(true);
  });
  it('false on missing/invalid date', () => {
    const a: Asset = { id: '1', type: 'money', name: 'x', value: 1, createdAt: '' };
    expect(hasHawlPassed(a, now)).toBe(false);
  });
});

describe('computeZakat hawl + receivables', () => {
  const now = Date.now();
  const recent = new Date(now - 30 * 86_400_000).toISOString();
  const old    = new Date(now - 400 * 86_400_000).toISOString();

  it('excludes hawl-pending assets and reports them as pendingTotal', () => {
    const assets: Asset[] = [
      { id: 'a', type: 'money', name: 'old',    value: 50000, createdAt: old },
      { id: 'b', type: 'money', name: 'recent', value: 9999,  createdAt: recent },
    ];
    const r = computeZakat(assets, PRICES, 'silver', {});
    expect(r.zakatableTotal).toBeCloseTo(50000);
    expect(r.pendingTotal).toBeCloseTo(9999);
  });

  it('counts items relying on createdAt fallback', () => {
    const assets: Asset[] = [
      { id: 'a', type: 'money', name: 'no-purchase', value: 50000, createdAt: old },
    ];
    const r = computeZakat(assets, PRICES, 'silver', {});
    expect(r.usedCreatedAtCount).toBe(1);
  });

  it('aggregates owed_to_me debts as a receivables breakdown row, not zakatable by default', () => {
    const debts: Debt[] = [
      { id: 'd1', direction: 'owed_to_me', name: 'Bob', amount: 5000, people: [], transactions: [], createdAt: old },
    ];
    const r = computeZakat([], PRICES, 'silver', {}, {}, debts);
    const recv = r.breakdown.find(b => b.categoryId === 'receivables');
    expect(recv).toBeDefined();
    expect(recv!.total).toBeCloseTo(5000);
    expect(recv!.isZakatable).toBe(false);
  });

  it('honours receivables override → included in zakatable total', () => {
    const debts: Debt[] = [
      { id: 'd1', direction: 'owed_to_me', name: 'Bob', amount: 5000, people: [], transactions: [], createdAt: old },
    ];
    const assets: Asset[] = [
      { id: 'a', type: 'money', name: 'cash', value: 50000, createdAt: old },
    ];
    const r = computeZakat(assets, PRICES, 'silver', { receivables: true }, {}, debts);
    expect(r.zakatableTotal).toBeCloseTo(55000);
  });
});

describe('computeZakat lineItems (receipt)', () => {
  const now    = Date.now();
  const old    = new Date(now - 400 * 86_400_000).toISOString();
  const recent = new Date(now - 30  * 86_400_000).toISOString();

  it('includes only hawl-met zakatable assets', () => {
    const assets: Asset[] = [
      { id: 'a', type: 'money',       name: 'cash',  value: 50000,  createdAt: old },
      { id: 'b', type: 'real_estate', name: 'house', value: 200000, createdAt: old },
      { id: 'c', type: 'money',       name: 'new',   value: 1000,   createdAt: recent },
    ];
    const r = computeZakat(assets, PRICES, 'silver', {});
    expect(r.lineItems).toHaveLength(1);
    expect(r.lineItems[0].assetId).toBe('a');
    expect(r.lineItems[0].zakatAmount).toBeCloseTo(50000 * 0.025);
  });

  it('sum of lineItem.value equals zakatableTotal', () => {
    const assets: Asset[] = [
      { id: 'a', type: 'money', name: 'a', value: 30000, createdAt: old },
      { id: 'b', type: 'money', name: 'b', value: 20000, createdAt: old },
    ];
    const r = computeZakat(assets, PRICES, 'silver', {});
    const sum = r.lineItems.reduce((s, i) => s + i.value, 0);
    expect(sum).toBeCloseTo(r.zakatableTotal);
  });

  it('sorted by value descending', () => {
    const assets: Asset[] = [
      { id: 'a', type: 'money', name: 'small', value: 10000, createdAt: old },
      { id: 'b', type: 'money', name: 'big',   value: 40000, createdAt: old },
    ];
    const r = computeZakat(assets, PRICES, 'silver', {});
    expect(r.lineItems[0].value).toBeGreaterThan(r.lineItems[1].value);
  });

  it('usedCreatedAtFallback is true when purchasedAt is missing', () => {
    const assets: Asset[] = [
      { id: 'a', type: 'money', name: 'x', value: 50000, createdAt: old },
    ];
    const r = computeZakat(assets, PRICES, 'silver', {});
    expect(r.lineItems[0].usedCreatedAtFallback).toBe(true);
  });

  it('receivables appear in lineItems only when override enabled', () => {
    const debts: Debt[] = [{ id: 'd1', direction: 'owed_to_me', name: 'Bob', amount: 5000, people: [], transactions: [], createdAt: old }];
    const assets: Asset[] = [{ id: 'a', type: 'money', name: 'cash', value: 50000, createdAt: old }];

    const rOn = computeZakat(assets, PRICES, 'silver', { receivables: true }, {}, debts);
    expect(rOn.lineItems.find(i => i.categoryId === 'receivables')).toBeDefined();

    const rOff = computeZakat(assets, PRICES, 'silver', {}, {}, debts);
    expect(rOff.lineItems.find(i => i.categoryId === 'receivables')).toBeUndefined();
  });
});
