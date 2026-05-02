import type { SQLiteDatabase } from 'expo-sqlite';
import type { Asset } from '../models/Asset';
import type { LivePrices } from '../models/PriceMap';
import { SUBTYPE_TO_PRICE_KEY } from '../models/PriceMap';
import {
  dbGetAssets, dbAddAsset, dbUpdateAsset, dbDeleteAsset,
} from '../repositories/AssetRepository';
import { dbSnapHistory } from '../repositories/HistoryRepository';

export function calcValue(
  asset: Asset,
  prices: Partial<LivePrices>,
  fxRates: Record<string, number> = {},
): number | null {
  if (asset.type === 'metals' || asset.type === 'crypto') {
    const key = asset.subtype ? SUBTYPE_TO_PRICE_KEY[asset.subtype] : undefined;
    if (!key) return null;
    const price = prices[key];
    if (price == null) return null;
    const qty = asset.quantity ?? 0;
    if (asset.type === 'metals') {
      const purity = asset.purity ?? 1000;       // millesimal; default = pure
      return qty * price * (purity / 1000);
    }
    return qty * price;
  }
  const raw = asset.value ?? 0;
  if (!asset.currency) return raw;            // legacy rows assumed to be in settings currency
  const rate = fxRates[asset.currency] ?? 1;  // unknown currency → no conversion
  return raw * rate;
}

export function getTotalWorth(
  assets: Asset[],
  prices: Partial<LivePrices>,
  fxRates: Record<string, number> = {},
): number {
  return assets.reduce((sum, a) => {
    const v = calcValue(a, prices, fxRates);
    return v != null ? sum + v : sum;
  }, 0);
}

export async function getAssets(db: SQLiteDatabase): Promise<Asset[]> {
  return dbGetAssets(db);
}

export async function addAsset(
  db: SQLiteDatabase,
  data: Omit<Asset, 'id' | 'createdAt'>,
  prices: Partial<LivePrices>,
  fxRates: Record<string, number> = {},
): Promise<Asset> {
  const asset: Asset = {
    ...data,
    id:        Date.now().toString(),
    createdAt: new Date().toISOString(),
  } as Asset;
  await dbAddAsset(db, asset);
  const all = await dbGetAssets(db);
  await dbSnapHistory(db, getTotalWorth(all, prices, fxRates));
  return asset;
}

export async function updateAsset(
  db: SQLiteDatabase,
  id: string,
  data: Partial<Omit<Asset, 'id' | 'createdAt'>>,
  prices: Partial<LivePrices>,
  fxRates: Record<string, number> = {},
): Promise<void> {
  const updatedAt = new Date().toISOString();
  await dbUpdateAsset(db, id, { ...data, updatedAt });
  const all = await dbGetAssets(db);
  await dbSnapHistory(db, getTotalWorth(all, prices, fxRates));
}

export async function deleteAsset(
  db: SQLiteDatabase,
  id: string,
  prices: Partial<LivePrices>,
  fxRates: Record<string, number> = {},
): Promise<void> {
  await dbDeleteAsset(db, id);
  const all = await dbGetAssets(db);
  await dbSnapHistory(db, getTotalWorth(all, prices, fxRates));
}
