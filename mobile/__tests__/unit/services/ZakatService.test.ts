import { computeZakat, ZAKAT_RATE } from '../../../lib/services/ZakatService';
import type { Asset } from '../../../lib/models/Asset';
import type { LivePrices } from '../../../lib/models/PriceMap';

const PRICES: LivePrices = {
  gold: 126.79,  // ~€3936/oz / 31.1035
  silver: 1.03,
  platinum: 30, palladium: 35,
  bitcoin: 52000, ethereum: 2800, solana: 140, bnb: 380,
};

const makeAsset = (type: Asset['type'], value: number, subtype?: string): Asset => ({
  id: Math.random().toString(),
  type, subtype, name: type,
  value: type === 'money' || type === 'real_estate' || type === 'vehicle' || type === 'jewelry' || type === 'collectibles' ? value : undefined,
  quantity: type === 'metals' || type === 'crypto' ? value : undefined,
  unit: 'g',
  createdAt: '',
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
    const cryptoAsset: Asset = { id: '1', type: 'crypto', subtype: 'bitcoin', name: 'BTC', quantity: 1, createdAt: '' };
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
