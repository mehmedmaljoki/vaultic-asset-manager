import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLES } from '../db/schema';
import type { Asset } from '../models/Asset';

function rowToAsset(row: Record<string, unknown>): Asset {
  return {
    id:          row.id as string,
    type:        row.type as Asset['type'],
    subtype:     (row.subtype as string) ?? undefined,
    name:        row.name as string,
    quantity:    row.quantity != null ? (row.quantity as number) : undefined,
    unit:        (row.unit as string) ?? undefined,
    value:       row.value != null ? (row.value as number) : undefined,
    purchasedAt: (row.purchased_at as string) ?? undefined,
    createdAt:   row.created_at as string,
    updatedAt:   (row.updated_at as string) ?? undefined,
  };
}

export async function dbGetAssets(db: SQLiteDatabase): Promise<Asset[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM ${TABLES.ASSETS} ORDER BY created_at DESC`
  );
  return rows.map(rowToAsset);
}

export async function dbAddAsset(db: SQLiteDatabase, asset: Asset): Promise<void> {
  await db.runAsync(
    `INSERT INTO ${TABLES.ASSETS}
     (id, type, subtype, name, quantity, unit, value, purchased_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [asset.id, asset.type, asset.subtype ?? null, asset.name,
     asset.quantity ?? null, asset.unit ?? null, asset.value ?? null,
     asset.purchasedAt ?? null, asset.createdAt, asset.updatedAt ?? null]
  );
}

export async function dbUpdateAsset(
  db: SQLiteDatabase,
  id: string,
  data: Partial<Omit<Asset, 'id' | 'createdAt'>>
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  const map: [string, unknown][] = [
    ['type',         data.type],
    ['subtype',      data.subtype],
    ['name',         data.name],
    ['quantity',     data.quantity],
    ['unit',         data.unit],
    ['value',        data.value],
    ['purchased_at', data.purchasedAt],
    ['updated_at',   data.updatedAt],
  ];

  for (const [col, val] of map) {
    if (val !== undefined) {
      fields.push(`${col}=?`);
      values.push(val as string | number | null);
    }
  }

  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(
    `UPDATE ${TABLES.ASSETS} SET ${fields.join(', ')} WHERE id=?`,
    values
  );
}

export async function dbDeleteAsset(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM ${TABLES.ASSETS} WHERE id=?`, [id]);
}
