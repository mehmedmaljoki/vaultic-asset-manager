import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Asset, Debt, DebtTransaction, HistoryPoint } from './types';

export const MOCK_PRICES = {
  gold: 60.50,
  silver: 0.82,
  platinum: 29.80,
  palladium: 38.40,
  bitcoin: 52340,
  ethereum: 2810,
  solana: 142,
  bnb: 385,
  NISAB_SILVER_G: 612.36,
  NISAB_GOLD_G: 85,
};

export const CATEGORIES = [
  { id: 'metals',       name: 'Metals',       icon: 'diamond-outline',   color: '#b8972a' },
  { id: 'money',        name: 'Cash & Bank',  icon: 'wallet-outline',    color: '#2a8a5a' },
  { id: 'real_estate',  name: 'Real Estate',  icon: 'home-outline',      color: '#4a60a8' },
  { id: 'vehicle',      name: 'Vehicle',      icon: 'car-outline',       color: '#7a50a8' },
  { id: 'crypto',       name: 'Crypto',       icon: 'logo-bitcoin',      color: '#d85020' },
  { id: 'jewelry',      name: 'Jewelry',      icon: 'sparkles-outline',  color: '#b830a0' },
  { id: 'collectibles', name: 'Collectibles', icon: 'star-outline',      color: '#a06030' },
];

const KEYS = {
  ASSETS:  'oam_assets',
  HISTORY: 'oam_history',
  DEBTS:   'oam_debts',
  SEEDED:  'oam_seeded',
};

async function load<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function persist(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function getAssets(): Promise<Asset[]> {
  return (await load<Asset[]>(KEYS.ASSETS)) ?? [];
}

export async function getHistory(): Promise<HistoryPoint[]> {
  return (await load<HistoryPoint[]>(KEYS.HISTORY)) ?? [];
}

export async function getDebts(): Promise<Debt[]> {
  return (await load<Debt[]>(KEYS.DEBTS)) ?? [];
}

export function calcValue(asset: Asset): number {
  if (asset.type === 'metals') return (asset.quantity ?? 0) * (MOCK_PRICES[asset.subtype as keyof typeof MOCK_PRICES] as number ?? 0);
  if (asset.type === 'crypto') return (asset.quantity ?? 0) * (MOCK_PRICES[asset.subtype as keyof typeof MOCK_PRICES] as number ?? 0);
  return asset.value ?? 0;
}

export function getTotalWorth(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + calcValue(a), 0);
}

async function snapHistory(assets: Asset[]): Promise<void> {
  const h = await getHistory();
  h.push({ date: new Date().toISOString(), total: getTotalWorth(assets) });
  if (h.length > 730) h.shift();
  await persist(KEYS.HISTORY, h);
}

export async function updateAsset(id: string, data: Partial<Omit<Asset, 'id' | 'createdAt'>>): Promise<void> {
  const assets = await getAssets();
  const i = assets.findIndex(a => a.id === id);
  if (i >= 0) {
    assets[i] = { ...assets[i], ...data, updatedAt: new Date().toISOString() };
    await persist(KEYS.ASSETS, assets);
    await snapHistory(assets);
  }
}

export async function deleteAsset(id: string): Promise<void> {
  const assets = (await getAssets()).filter(a => a.id !== id);
  await persist(KEYS.ASSETS, assets);
  await snapHistory(assets);
}

export async function addAsset(data: Omit<Asset, 'id' | 'createdAt'>): Promise<Asset> {
  const assets = await getAssets();
  const a: Asset = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() } as Asset;
  assets.push(a);
  await persist(KEYS.ASSETS, assets);
  await snapHistory(assets);
  return a;
}

export async function seedDemo(): Promise<void> {
  const already = await AsyncStorage.getItem(KEYS.SEEDED);
  if (already) return;

  const seedAssets = [
    { type: 'metals',      subtype: 'gold',     name: 'Gold Bars',       quantity: 50,   unit: 'g' },
    { type: 'metals',      subtype: 'silver',   name: 'Silver Coins',    quantity: 800,  unit: 'g' },
    { type: 'crypto',      subtype: 'bitcoin',  name: 'Bitcoin',         quantity: 0.25, unit: 'BTC' },
    { type: 'crypto',      subtype: 'ethereum', name: 'Ethereum',        quantity: 2,    unit: 'ETH' },
    { type: 'money',                            name: 'Savings Account', value: 8500 },
    { type: 'real_estate',                      name: 'Apartment',       value: 180000 },
    { type: 'vehicle',                          name: 'Car',             value: 14000 },
    { type: 'jewelry',                          name: 'Gold Ring',       value: 1200 },
  ] as Omit<Asset, 'id' | 'createdAt'>[];

  const assets: Asset[] = seedAssets.map((d, i) => ({
    ...d,
    id: (Date.now() + i).toString(),
    createdAt: new Date().toISOString(),
  } as Asset));

  await persist(KEYS.ASSETS, assets);

  const now = new Date().toISOString();
  const debts: Debt[] = [
    { id: '1', direction: 'owed_to_me', name: 'Ali Hassan', amount: 500,  note: 'Personal loan',    people: ['Ali Hassan'], transactions: [{ id: 't1', amount: 500,  date: now, note: 'Initial amount' }], createdAt: now },
    { id: '2', direction: 'owed_to_me', name: 'Sara Malik', amount: 200,  note: 'Borrowed cash',    people: ['Sara Malik'], transactions: [{ id: 't2', amount: 200,  date: now, note: 'Initial amount' }], createdAt: now },
    { id: '3', direction: 'i_owe',      name: 'Bank Loan',  amount: 3500, note: 'Personal finance', people: ['Bank'],       transactions: [{ id: 't3', amount: 3500, date: now, note: 'Initial amount' }], createdAt: now },
  ];
  await persist(KEYS.DEBTS, debts);

  // Seed 60 days of history
  const base = getTotalWorth(assets);
  const history: HistoryPoint[] = [];
  for (let i = 59; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const noise = 1 + (Math.sin(i * 0.4) * 0.03 + (Math.random() - 0.5) * 0.04);
    history.push({ date: d.toISOString(), total: base * noise });
  }
  history.push({ date: new Date().toISOString(), total: base });
  await persist(KEYS.HISTORY, history);

  await AsyncStorage.setItem(KEYS.SEEDED, '1');
}

export async function addDebt(data: Omit<Debt, 'id' | 'createdAt' | 'transactions'>): Promise<Debt> {
  const debts = await getDebts();
  const now = new Date().toISOString();
  const d: Debt = {
    ...data,
    id: Date.now().toString(),
    createdAt: now,
    transactions: [{ id: Date.now().toString(), amount: data.amount, date: now, note: 'Initial amount' }],
  };
  debts.push(d);
  await persist(KEYS.DEBTS, debts);
  return d;
}

export async function adjustDebt(id: string, delta: number, note: string): Promise<void> {
  const debts = await getDebts();
  const d = debts.find(x => x.id === id);
  if (d) {
    d.amount = Math.max(0, d.amount + delta);
    d.transactions.push({ id: Date.now().toString(), amount: delta, date: new Date().toISOString(), note });
    d.updatedAt = new Date().toISOString();
    await persist(KEYS.DEBTS, debts);
  }
}

export async function deleteDebt(id: string): Promise<void> {
  const debts = (await getDebts()).filter(d => d.id !== id);
  await persist(KEYS.DEBTS, debts);
}

// ── Settings ──────────────────────────────────────────────────────────────────
const SETTINGS_KEY = 'oam_settings';

export const SETTINGS_DEFAULTS = {
  currency:    'EUR',
  themeMode:   'system' as 'light' | 'dark' | 'system',
  privacyMode: false,
  apiProvider: 'mock',
  apiKey:      '',
  language:    'en',
};
export type Settings = typeof SETTINGS_DEFAULTS;

export async function getSettings(): Promise<Settings> {
  const saved = await load<Partial<Settings>>(SETTINGS_KEY);
  return { ...SETTINGS_DEFAULTS, ...saved };
}
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await persist(SETTINGS_KEY, { ...current, ...patch });
}

// ── Backup / restore ──────────────────────────────────────────────────────────
export async function exportData(): Promise<string> {
  const [assets, debts, history, settings] = await Promise.all([
    getAssets(), getDebts(), getHistory(), getSettings(),
  ]);
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), assets, debts, history, settings },
    null, 2
  );
}

export async function importData(json: string): Promise<boolean> {
  try {
    const data = JSON.parse(json);
    if (data.assets)   await persist(KEYS.ASSETS,   data.assets);
    if (data.debts)    await persist(KEYS.DEBTS,     data.debts);
    if (data.history)  await persist(KEYS.HISTORY,   data.history);
    if (data.settings) await persist(SETTINGS_KEY,   data.settings);
    return true;
  } catch { return false; }
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.ASSETS, KEYS.HISTORY, KEYS.DEBTS, SETTINGS_KEY, KEYS.SEEDED,
  ]);
}

export function formatCurrency(n: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n ?? 0);
  } catch {
    return `€${(n ?? 0).toFixed(0)}`;
  }
}
