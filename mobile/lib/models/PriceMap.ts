export const TROY_OZ_TO_GRAM = 31.1035;

export const NISAB_SILVER_G = 612.36;
export const NISAB_GOLD_G   = 85;

export const METAL_SYMBOLS = ['XAU', 'XAG', 'XPT', 'XPD'] as const;
export type  MetalSymbol   = typeof METAL_SYMBOLS[number];

export const CRYPTO_SYMBOLS = ['bitcoin', 'ethereum', 'solana', 'bnb'] as const;
export type  CryptoSymbol   = typeof CRYPTO_SYMBOLS[number];

/** Per-gram prices for metals; per-unit for crypto. null = no data available. */
export interface LivePrices {
  gold:      number | null;
  silver:    number | null;
  platinum:  number | null;
  palladium: number | null;
  bitcoin:   number | null;
  ethereum:  number | null;
  solana:    number | null;
  bnb:       number | null;
}

export const EMPTY_PRICES: LivePrices = {
  gold: null, silver: null, platinum: null, palladium: null,
  bitcoin: null, ethereum: null, solana: null, bnb: null,
};

/** Map from asset subtype string to LivePrices key */
export const SUBTYPE_TO_PRICE_KEY: Record<string, keyof LivePrices> = {
  gold:      'gold',
  silver:    'silver',
  platinum:  'platinum',
  palladium: 'palladium',
  bitcoin:   'bitcoin',
  ethereum:  'ethereum',
  solana:    'solana',
  bnb:       'bnb',
};
