import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import type { Asset } from '../models/Asset';
import type { Debt } from '../models/Debt';
import { dbAddAsset } from '../repositories/AssetRepository';
import { dbAddDebt } from '../repositories/DebtRepository';
import { dbInsertHistoryBatch } from '../repositories/HistoryRepository';
import { EMPTY_PRICES } from '../models/PriceMap';

const SEED_FLAG = 'seeded';

export async function seedDemo(db: SQLiteDatabase): Promise<void> {
  const flagRow = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM ${TABLES.SETTINGS} WHERE key=?`,
    [SEED_FLAG]
  );
  if (flagRow) return;

  const now = new Date().toISOString();

  const seedAssets: Omit<Asset, 'id' | 'createdAt'>[] = [
    { type: 'metals',      subtype: 'gold',     name: 'Gold Bars',       quantity: 50,     unit: 'g' },
    { type: 'metals',      subtype: 'silver',   name: 'Silver Coins',    quantity: 800,    unit: 'g' },
    { type: 'crypto',      subtype: 'bitcoin',  name: 'Bitcoin',         quantity: 0.25,   unit: 'BTC' },
    { type: 'crypto',      subtype: 'ethereum', name: 'Ethereum',        quantity: 2,      unit: 'ETH' },
    { type: 'money',                            name: 'Savings Account', value: 8500 },
    { type: 'real_estate',                      name: 'Apartment',       value: 180000 },
    { type: 'vehicle',                          name: 'Car',             value: 14000 },
    { type: 'jewelry',                          name: 'Gold Ring',       value: 1200 },
  ];

  const assets: Asset[] = seedAssets.map((d, i) => ({
    ...d,
    id:        `seed_${Date.now()}_${i}`,
    createdAt: now,
  } as Asset));

  for (const a of assets) await dbAddAsset(db, a);

  const debts: Debt[] = [
    {
      id: 'seed_d1', direction: 'owed_to_me', name: 'Ali Hassan', amount: 500,
      note: 'Personal loan', people: ['Ali Hassan'],
      transactions: [{ id: 'seed_t1', amount: 500, date: now, note: 'Initial amount' }],
      createdAt: now,
    },
    {
      id: 'seed_d2', direction: 'owed_to_me', name: 'Sara Malik', amount: 200,
      note: 'Borrowed cash', people: ['Sara Malik'],
      transactions: [{ id: 'seed_t2', amount: 200, date: now, note: 'Initial amount' }],
      createdAt: now,
    },
    {
      id: 'seed_d3', direction: 'i_owe', name: 'Bank Loan', amount: 3500,
      note: 'Personal finance', people: ['Bank'],
      transactions: [{ id: 'seed_t3', amount: 3500, date: now, note: 'Initial amount' }],
      createdAt: now,
    },
  ];
  for (const d of debts) await dbAddDebt(db, d);

  // Seed 60 days of history. Fixed-value assets only (metals/crypto need live prices).
  const fixedTotal = assets
    .filter(a => a.type !== 'metals' && a.type !== 'crypto')
    .reduce((s, a) => s + (a.value ?? 0), 0);
  const base = fixedTotal; // 8 500 + 180 000 + 14 000 + 1 200 = 203 700

  const history = [];
  for (let i = 59; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const noise = 1 + (Math.sin(i * 0.4) * 0.03 + (Math.random() - 0.5) * 0.04);
    history.push({ date: d.toISOString(), total: base * noise });
  }
  history.push({ date: now, total: base });
  await dbInsertHistoryBatch(db, history);

  await db.runAsync(
    `INSERT OR REPLACE INTO ${TABLES.SETTINGS} (key, value) VALUES (?,?)`,
    [SEED_FLAG, '1']
  );
}
