import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import type { CustomCoin } from '../models/CustomCoin';

const COLS = 'id, name, metal, gross_weight_g as grossWeightG, fineness, created_at as createdAt';

export async function dbGetCustomCoins(db: SQLiteDatabase): Promise<CustomCoin[]> {
  return db.getAllAsync<CustomCoin>(
    `SELECT ${COLS} FROM ${TABLES.CUSTOM_COINS} ORDER BY created_at DESC`,
  );
}

export async function dbAddCustomCoin(db: SQLiteDatabase, c: CustomCoin): Promise<void> {
  await db.runAsync(
    `INSERT INTO ${TABLES.CUSTOM_COINS} (id, name, metal, gross_weight_g, fineness, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [c.id, c.name, c.metal, c.grossWeightG, c.fineness, c.createdAt],
  );
}
