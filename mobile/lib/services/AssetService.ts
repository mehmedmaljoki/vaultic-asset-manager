import type { SQLiteDatabase } from 'expo-sqlite';
import type { Asset } from '../models/Asset';
import type { LivePrices } from '../models/PriceMap';
import { SUBTYPE_TO_PRICE_KEY } from '../models/PriceMap';
import {
  dbGetAssets, dbAddAsset, dbUpdateAsset, dbDeleteAsset,
} from '../repositories/AssetRepository';
import { dbSnapHistory } from '../repositories/HistoryRepository';

export function calcValue(asset: Asset, prices: Partial<LivePrices>): number | null {
  if (asset.type === 'metals' || asset.type === 'crypto') {
    const key = asset.subtype ? SUBTYPE_TO_PRICE_KEY[asset.subtype] : undefined;
    if (!key) return null;
    const price = prices[key];
    if (price == null) return null;
    return (asset.quantity ?? 0) * price;
  }
  return asset.value ?? 0;
}

export function getTotalWorth(assets: Asset[], prices: Partial<LivePrices>): number {
  return assets.reduce((sum, a) => {
    const v = calcValue(a, prices);
    return v != null ? sum + v : sum;
  }, 0);
}

export async function getAssets(db: SQLiteDatabase): Promise<Asset[]> {
  return dbGetAssets(db);
}

export async function addAsset(
  db: SQLiteDatabase,
  data: Omit<Asset, 'id' | 'createdAt'>,
  prices: Partial<LivePrices>
): Promise<Asset> {
  const asset: Asset = {
    ...data,
    id:        Date.now().toString(),
    createdAt: new Date().toISOString(),
  } as Asset;
  await dbAddAsset(db, asset);
  const all = await dbGetAssets(db);
  await dbSnapHistory(db, getTotalWorth(all, prices));
  return asset;
}

export async function updateAsset(
  db: SQLiteDatabase,
  id: string,
  data: Partial<Omit<Asset, 'id' | 'createdAt'>>,
  prices: Partial<LivePrices>
): Promise<void> {
  const updatedAt = new Date().toISOString();
  await dbUpdateAsset(db, id, { ...data, updatedAt });
  const all = await dbGetAssets(db);
  await dbSnapHistory(db, getTotalWorth(all, prices));
}

export async function deleteAsset(
  db: SQLiteDatabase,
  id: string,
  prices: Partial<LivePrices>
): Promise<void> {
  await dbDeleteAsset(db, id);
  const all = await dbGetAssets(db);
  await dbSnapHistory(db, getTotalWorth(all, prices));
}
