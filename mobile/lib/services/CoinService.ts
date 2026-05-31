import type { Asset } from '../models/Asset';
import type { CustomCoin } from '../models/CustomCoin';
import { COIN_CATALOG, PREFERRED_COUNTRY_ORDER, type CatalogCoin } from '../models/CoinCatalog';

export const OWN_COUNTRY_CODE = 'OWN';

export interface CoinOption {
  id: string;
  name: string;
  metal: 'gold' | 'silver';
  grossWeightG: number;
  fineness: number;
  alloy: string;
  countryCode: string;
  aliases: string[];
}

export interface CountryOption { code: string; name: string; }

function catalogToOption(c: CatalogCoin): CoinOption {
  return {
    id: c.id, name: c.name, metal: c.metal, grossWeightG: c.grossWeightG,
    fineness: c.fineness, alloy: c.alloy, countryCode: c.countryCode, aliases: c.aliases,
  };
}

function customToOption(c: CustomCoin): CoinOption {
  const metalLabel = c.metal === 'gold' ? 'Gold' : 'Silver';
  return {
    id: c.id, name: c.name, metal: c.metal, grossWeightG: c.grossWeightG,
    fineness: c.fineness, alloy: `${metalLabel} ${c.fineness}`,
    countryCode: OWN_COUNTRY_CODE, aliases: [c.name.toLowerCase()],
  };
}

/** Distinct countries that have at least one coin, preferred ones first then alphabetical.
 *  Appends an "Own" pseudo-country when custom coins exist. */
export function getCountries(customs: CustomCoin[]): CountryOption[] {
  const byCode = new Map<string, string>();
  for (const c of COIN_CATALOG) byCode.set(c.countryCode, c.country);

  const codes = Array.from(byCode.keys());
  codes.sort((a, b) => {
    const ia = PREFERRED_COUNTRY_ORDER.indexOf(a);
    const ib = PREFERRED_COUNTRY_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return (byCode.get(a) ?? '').localeCompare(byCode.get(b) ?? '');
  });

  const result: CountryOption[] = codes.map(code => ({ code, name: byCode.get(code)! }));
  if (customs.length > 0) result.push({ code: OWN_COUNTRY_CODE, name: 'Own' });
  return result;
}

export function getCoinsByCountry(code: string, customs: CustomCoin[]): CoinOption[] {
  if (code === OWN_COUNTRY_CODE) return customs.map(customToOption);
  return COIN_CATALOG.filter(c => c.countryCode === code).map(catalogToOption);
}

export function searchCoinsInCountry(code: string, query: string, customs: CustomCoin[]): CoinOption[] {
  const q = query.trim().toLowerCase();
  const coins = getCoinsByCountry(code, customs);
  if (!q) return coins;
  return coins.filter(c =>
    c.name.toLowerCase().includes(q) || c.aliases.some(a => a.includes(q)));
}

/** Build the asset fields for a coin holding of `count` pieces. */
export function coinToAssetFields(coin: CoinOption, count: number): Partial<Asset> {
  return {
    type: 'metals',
    subtype: coin.metal,
    name: coin.name,
    quantity: count,
    unit: 'coin',
    purity: coin.fineness,
    gramsPerUnit: coin.grossWeightG,
    coinId: coin.id,
  };
}
