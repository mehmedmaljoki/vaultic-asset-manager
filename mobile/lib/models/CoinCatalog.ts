export interface CatalogCoin {
  id: string;             // stable id, e.g. 'TR_ceyrek_ziynet'
  countryCode: string;    // ISO-ish grouping key, e.g. 'TR'
  country: string;        // display name, e.g. 'Türkei'
  name: string;           // proper name, not translated
  aliases: string[];      // lowercase search terms
  metal: 'gold' | 'silver';
  grossWeightG: number;   // gross weight per piece
  fineness: number;       // millesimal (e.g. 916)
  fineGoldG: number;      // pure metal content per piece (display/sanity)
  alloy: string;          // human-readable alloy, shown on selection
  notes?: string;
}

// Countries listed first in the picker (locally most relevant), rest sorted alphabetically by `country`.
export const PREFERRED_COUNTRY_ORDER = ['TR', 'AT', 'DE', 'CH'];

export const COIN_CATALOG: CatalogCoin[] = [
  // ── Türkei ───────────────────────────────────────────────
  { id: 'TR_ceyrek_ziynet',   countryCode: 'TR', country: 'Türkei', name: 'Çeyrek Altın (Ziynet)', aliases: ['ceyrek','çeyrek','quarter','ziynet'], metal: 'gold', grossWeightG: 1.754, fineness: 916, fineGoldG: 1.607, alloy: 'Au-Cu (22 Karat)', notes: 'Ziynet (jewelry) standard — most traded quarter.' },
  { id: 'TR_ceyrek_ata',      countryCode: 'TR', country: 'Türkei', name: 'Çeyrek Altın (Ata/Sikke)', aliases: ['ceyrek','çeyrek','ata','sikke'], metal: 'gold', grossWeightG: 1.804, fineness: 916, fineGoldG: 1.653, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_yarim_ziynet',    countryCode: 'TR', country: 'Türkei', name: 'Yarım Altın (Ziynet)', aliases: ['yarim','yarım','half','ziynet'], metal: 'gold', grossWeightG: 3.508, fineness: 916, fineGoldG: 3.213, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_yarim_ata',       countryCode: 'TR', country: 'Türkei', name: 'Yarım Altın (Ata/Sikke)', aliases: ['yarim','yarım','ata','sikke'], metal: 'gold', grossWeightG: 3.608, fineness: 916, fineGoldG: 3.305, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_tam_ziynet',      countryCode: 'TR', country: 'Türkei', name: 'Tam Altın (Ziynet)', aliases: ['tam','full','ziynet'], metal: 'gold', grossWeightG: 7.016, fineness: 916, fineGoldG: 6.427, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_cumhuriyet',      countryCode: 'TR', country: 'Türkei', name: 'Cumhuriyet Altını (Ata Lira)', aliases: ['cumhuriyet','tam ata','ata lirasi','birlik'], metal: 'gold', grossWeightG: 7.216, fineness: 916, fineGoldG: 6.610, alloy: 'Au-Cu (22 Karat)', notes: 'Full Cumhuriyet sikke standard.' },
  { id: 'TR_ikibucuk',        countryCode: 'TR', country: 'Türkei', name: 'İkibuçukluk Ata Altın (2.5)', aliases: ['ikibucuk','iki bucuk','2.5'], metal: 'gold', grossWeightG: 18.04, fineness: 916, fineGoldG: 16.525, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_besli',           countryCode: 'TR', country: 'Türkei', name: 'Beşli Ata Altın (5)', aliases: ['besli','beşli','5er'], metal: 'gold', grossWeightG: 36.08, fineness: 916, fineGoldG: 33.049, alloy: 'Au-Cu (22 Karat)' },
  { id: 'TR_resat',           countryCode: 'TR', country: 'Türkei', name: 'Reşat Altını', aliases: ['resat','reşat'], metal: 'gold', grossWeightG: 7.216, fineness: 916, fineGoldG: 6.610, alloy: 'Au-Cu (22 Karat)', notes: 'Ottoman, Mehmed V Reşat.' },
  { id: 'TR_hamit',           countryCode: 'TR', country: 'Türkei', name: 'Hamit Altını', aliases: ['hamit'], metal: 'gold', grossWeightG: 7.216, fineness: 916, fineGoldG: 6.610, alloy: 'Au-Cu (22 Karat)', notes: 'Ottoman, Abdülhamid II.' },

  // ── Österreich ───────────────────────────────────────────
  { id: 'AT_dukat_1',         countryCode: 'AT', country: 'Österreich', name: 'Dukat', aliases: ['dukat','ducat'], metal: 'gold', grossWeightG: 3.4909, fineness: 986, fineGoldG: 3.442, alloy: 'Au mit Cu/Ag (.986)', notes: 'Classic trade coin (.986).' },
  { id: 'AT_dukat_4',         countryCode: 'AT', country: 'Österreich', name: '4 Dukat', aliases: ['4 dukat','vierfachdukat','ducat'], metal: 'gold', grossWeightG: 13.9636, fineness: 986, fineGoldG: 13.768, alloy: 'Au mit Cu/Ag (.986)' },
  { id: 'AT_corona_100',      countryCode: 'AT', country: 'Österreich', name: '100 Corona', aliases: ['100 corona','100 kronen'], metal: 'gold', grossWeightG: 33.8753, fineness: 900, fineGoldG: 30.488, alloy: 'Au-Cu (90/10)' },
  { id: 'AT_corona_20',       countryCode: 'AT', country: 'Österreich', name: '20 Corona', aliases: ['20 corona','20 kronen'], metal: 'gold', grossWeightG: 6.7751, fineness: 900, fineGoldG: 6.098, alloy: 'Au-Cu (90/10)' },
  { id: 'AT_corona_10',       countryCode: 'AT', country: 'Österreich', name: '10 Corona', aliases: ['10 corona','10 kronen'], metal: 'gold', grossWeightG: 3.3876, fineness: 900, fineGoldG: 3.049, alloy: 'Au-Cu (90/10)' },
  { id: 'AT_florin_8',        countryCode: 'AT', country: 'Österreich', name: '8 Florin / 20 Francs', aliases: ['8 florin','8 gulden','20 francs'], metal: 'gold', grossWeightG: 6.4516, fineness: 900, fineGoldG: 5.806, alloy: 'Au-Cu (90/10)' },
  { id: 'AT_phil_1oz',        countryCode: 'AT', country: 'Österreich', name: 'Wiener Philharmoniker 1 oz', aliases: ['philharmoniker','vienna philharmonic','phil'], metal: 'gold', grossWeightG: 31.103, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)' },
  { id: 'AT_phil_half',       countryCode: 'AT', country: 'Österreich', name: 'Wiener Philharmoniker 1/2 oz', aliases: ['philharmoniker','phil'], metal: 'gold', grossWeightG: 15.552, fineness: 999.9, fineGoldG: 15.550, alloy: 'Au fein (.9999)' },
  { id: 'AT_phil_quarter',    countryCode: 'AT', country: 'Österreich', name: 'Wiener Philharmoniker 1/4 oz', aliases: ['philharmoniker','phil'], metal: 'gold', grossWeightG: 7.776, fineness: 999.9, fineGoldG: 7.775, alloy: 'Au fein (.9999)' },
  { id: 'AT_phil_tenth',      countryCode: 'AT', country: 'Österreich', name: 'Wiener Philharmoniker 1/10 oz', aliases: ['philharmoniker','phil'], metal: 'gold', grossWeightG: 3.110, fineness: 999.9, fineGoldG: 3.110, alloy: 'Au fein (.9999)' },

  // ── Schweiz / Frankreich ─────────────────────────────────
  { id: 'CH_vreneli_20',      countryCode: 'CH', country: 'Schweiz', name: 'Vreneli 20 Franken', aliases: ['vreneli','goldvreneli','20 franken'], metal: 'gold', grossWeightG: 6.4516, fineness: 900, fineGoldG: 5.806, alloy: 'Au-Cu (90/10)' },
  { id: 'FR_napoleon_20',     countryCode: 'FR', country: 'Frankreich', name: 'Napoléon 20 Francs', aliases: ['napoleon','marianne','20 francs'], metal: 'gold', grossWeightG: 6.4516, fineness: 900, fineGoldG: 5.806, alloy: 'Au-Cu (90/10)' },

  // ── International Bullion ─────────────────────────────────
  { id: 'ZA_krugerrand_1oz',  countryCode: 'ZA', country: 'Südafrika', name: 'Krugerrand 1 oz', aliases: ['krugerrand'], metal: 'gold', grossWeightG: 33.93, fineness: 916.7, fineGoldG: 31.103, alloy: 'Au-Cu (Rotgold)', notes: 'Contains exactly 1 oz fine gold.' },
  { id: 'CA_maple_1oz',       countryCode: 'CA', country: 'Kanada', name: 'Maple Leaf 1 oz', aliases: ['maple leaf','maple'], metal: 'gold', grossWeightG: 31.103, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)' },
  { id: 'US_eagle_1oz',       countryCode: 'US', country: 'USA', name: 'American Gold Eagle 1 oz', aliases: ['eagle','gold eagle'], metal: 'gold', grossWeightG: 33.931, fineness: 916.7, fineGoldG: 31.103, alloy: 'Au-Ag-Cu' },
  { id: 'US_buffalo_1oz',     countryCode: 'US', country: 'USA', name: 'American Buffalo 1 oz', aliases: ['buffalo'], metal: 'gold', grossWeightG: 31.108, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)' },
  { id: 'GB_sovereign',       countryCode: 'GB', country: 'Großbritannien', name: 'Sovereign', aliases: ['sovereign','full sovereign'], metal: 'gold', grossWeightG: 7.98805, fineness: 916.7, fineGoldG: 7.322, alloy: 'Au-Cu (Crown Gold)' },
  { id: 'GB_britannia_1oz',   countryCode: 'GB', country: 'Großbritannien', name: 'Britannia 1 oz', aliases: ['britannia'], metal: 'gold', grossWeightG: 31.103, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)', notes: 'Pre-2013 issues were 22k (.9167).' },
  { id: 'MX_centenario_50',   countryCode: 'MX', country: 'Mexiko', name: 'Centenario 50 Pesos', aliases: ['centenario','50 pesos'], metal: 'gold', grossWeightG: 41.666, fineness: 900, fineGoldG: 37.5, alloy: 'Au-Cu (90/10)' },
  { id: 'CN_panda_30g',       countryCode: 'CN', country: 'China', name: 'Panda 30 g', aliases: ['panda'], metal: 'gold', grossWeightG: 30.0, fineness: 999, fineGoldG: 29.97, alloy: 'Au fein (.999)' },
  { id: 'AU_kangaroo_1oz',    countryCode: 'AU', country: 'Australien', name: 'Kangaroo / Nugget 1 oz', aliases: ['kangaroo','nugget'], metal: 'gold', grossWeightG: 31.103, fineness: 999.9, fineGoldG: 31.103, alloy: 'Au fein (.9999)' },
];
