import {
  getCountries, getCoinsByCountry, searchCoinsInCountry, coinToAssetFields, OWN_COUNTRY_CODE,
} from '../../../lib/services/CoinService';
import type { CustomCoin } from '../../../lib/models/CustomCoin';

const customs: CustomCoin[] = [
  { id: 'custom_1', name: 'My Bar Coin', metal: 'gold', grossWeightG: 8, fineness: 999, createdAt: '2026-01-01' },
];

describe('CoinService', () => {
  it('lists preferred countries first, then alphabetical, and "Own" only when customs exist', () => {
    const withCustom = getCountries(customs).map(c => c.code);
    expect(withCustom[0]).toBe('TR');           // preferred order: TR, AT, DE, CH first
    expect(withCustom).toContain(OWN_COUNTRY_CODE);

    const noCustom = getCountries([]).map(c => c.code);
    expect(noCustom).not.toContain(OWN_COUNTRY_CODE);
  });

  it('returns catalog coins for a country code, each with an alloy string', () => {
    const tr = getCoinsByCountry('TR', []);
    expect(tr.length).toBeGreaterThan(0);
    expect(tr.every(c => c.countryCode === 'TR')).toBe(true);
    expect(tr.every(c => typeof c.alloy === 'string' && c.alloy.length > 0)).toBe(true);
  });

  it('returns custom coins under the OWN country code', () => {
    const own = getCoinsByCountry(OWN_COUNTRY_CODE, customs);
    expect(own.map(c => c.id)).toContain('custom_1');
  });

  it('searches by name and alias within a country', () => {
    const byAlias = searchCoinsInCountry('TR', 'ceyrek', []);
    expect(byAlias.some(c => c.id === 'TR_ceyrek_ziynet')).toBe(true);
    const byName = searchCoinsInCountry('AT', 'dukat', []);
    expect(byName.some(c => c.id === 'AT_dukat_1')).toBe(true);
  });

  it('maps a coin + count to asset fields', () => {
    const coin = getCoinsByCountry('TR', []).find(c => c.id === 'TR_ceyrek_ziynet')!;
    const fields = coinToAssetFields(coin, 5);
    expect(fields).toMatchObject({
      type: 'metals', subtype: 'gold', quantity: 5,
      gramsPerUnit: 1.754, purity: 916, coinId: 'TR_ceyrek_ziynet', unit: 'coin',
      name: 'Çeyrek Altın (Ziynet)',
    });
  });
});
