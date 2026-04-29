export interface Asset {
  id: string;
  type: 'metals' | 'money' | 'real_estate' | 'vehicle' | 'crypto' | 'jewelry' | 'collectibles';
  subtype?: string;
  name: string;
  quantity?: number;
  unit?: string;
  value?: number;
  purchasedAt?: string;   // user-defined acquisition date
  createdAt: string;
  updatedAt?: string;
}

export interface HistoryPoint {
  date: string;
  total: number;
}

export interface DebtTransaction {
  id: string;
  amount: number;
  date: string;
  note: string;
}

export interface Debt {
  id: string;
  direction: 'owed_to_me' | 'i_owe';
  name: string;
  amount: number;
  note?: string;
  people?: string[];
  transactions: DebtTransaction[];
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface MockPrices {
  gold: number;
  silver: number;
  platinum: number;
  palladium: number;
  bitcoin: number;
  ethereum: number;
  solana: number;
  bnb: number;
  NISAB_SILVER_G: number;
  NISAB_GOLD_G: number;
}
