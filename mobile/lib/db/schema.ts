import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'oam.db';

export const TABLES = {
  ASSETS:            'assets',
  DEBTS:             'debts',
  DEBT_TRANSACTIONS: 'debt_transactions',
  HISTORY:           'history',
  SETTINGS:          'settings',
  PRICE_CACHE:       'price_cache',
  FX_CACHE:          'fx_cache',
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

    CREATE TABLE IF NOT EXISTS ${TABLES.FX_CACHE} (
      base       TEXT NOT NULL,
      currency   TEXT NOT NULL,
      rate       REAL NOT NULL,
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (base, currency)
    );
  `);

  // Additive: ensure 'currency' and 'purity' columns exist on older assets tables.
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${TABLES.ASSETS})`);
  if (!cols.some(c => c.name === 'currency')) {
    await db.execAsync(`ALTER TABLE ${TABLES.ASSETS} ADD COLUMN currency TEXT`);
  }
  if (!cols.some(c => c.name === 'purity')) {
    await db.execAsync(`ALTER TABLE ${TABLES.ASSETS} ADD COLUMN purity REAL`);
  }

  // UNIQUE index on history(date,total) enables idempotent restore via INSERT OR IGNORE.
  await db.execAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_history_date_total ON ${TABLES.HISTORY}(date, total)`
  );

  // One-time cleanup of legacy seedDemo() rows. Runs on installs that previously
  // had the demo data; idempotent — once the `seeded` flag is gone, this is a no-op.
  const seededFlag = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM ${TABLES.SETTINGS} WHERE key = 'seeded'`
  );
  if (seededFlag) {
    await db.runAsync(`DELETE FROM ${TABLES.ASSETS}            WHERE id LIKE 'seed_%'`);
    await db.runAsync(`DELETE FROM ${TABLES.DEBT_TRANSACTIONS} WHERE id LIKE 'seed_%'`);
    await db.runAsync(`DELETE FROM ${TABLES.DEBTS}             WHERE id LIKE 'seed_%'`);
    await db.runAsync(`DELETE FROM ${TABLES.HISTORY}`);
    await db.runAsync(`DELETE FROM ${TABLES.SETTINGS} WHERE key = 'seeded'`);
  }
}
