import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'oam.db';

export const TABLES = {
  ASSETS:            'assets',
  DEBTS:             'debts',
  DEBT_TRANSACTIONS: 'debt_transactions',
  HISTORY:           'history',
  SETTINGS:          'settings',
  PRICE_CACHE:       'price_cache',
} as const;

export async function applyMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${TABLES.ASSETS} (
      id           TEXT PRIMARY KEY NOT NULL,
      type         TEXT NOT NULL,
      subtype      TEXT,
      name         TEXT NOT NULL,
      quantity     REAL,
      unit         TEXT,
      value        REAL,
      purchased_at TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS ${TABLES.DEBTS} (
      id         TEXT PRIMARY KEY NOT NULL,
      direction  TEXT NOT NULL,
      name       TEXT NOT NULL,
      amount     REAL NOT NULL DEFAULT 0,
      note       TEXT,
      people     TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ${TABLES.DEBT_TRANSACTIONS} (
      id      TEXT PRIMARY KEY NOT NULL,
      debt_id TEXT NOT NULL REFERENCES ${TABLES.DEBTS}(id) ON DELETE CASCADE,
      amount  REAL NOT NULL,
      date    TEXT NOT NULL,
      note    TEXT
    );

    CREATE TABLE IF NOT EXISTS ${TABLES.HISTORY} (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      date  TEXT NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${TABLES.SETTINGS} (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${TABLES.PRICE_CACHE} (
      symbol     TEXT NOT NULL,
      currency   TEXT NOT NULL,
      price      REAL NOT NULL,
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (symbol, currency)
    );
  `);
}
