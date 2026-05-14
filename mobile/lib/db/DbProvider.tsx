import React, { useEffect, useRef } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DB_NAME, TABLES, applyMigrations } from './schema';
import type { Asset } from '../models/Asset';
import type { Debt } from '../models/Debt';
import type { HistoryPoint } from '../models/History';

const MIGRATION_FLAG = 'oam_migrated_to_sqlite';

const LEGACY_KEYS = {
  ASSETS:   'oam_assets',
  HISTORY:  'oam_history',
  DEBTS:    'oam_debts',
  SEEDED:   'oam_seeded',
  SETTINGS: 'oam_settings',
};

function MigrationRunner({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const already = await AsyncStorage.getItem(MIGRATION_FLAG);
        if (already) return;

        const [rawAssets, rawDebts, rawHistory, rawSettings] = await Promise.all([
          AsyncStorage.getItem(LEGACY_KEYS.ASSETS),
          AsyncStorage.getItem(LEGACY_KEYS.DEBTS),
          AsyncStorage.getItem(LEGACY_KEYS.HISTORY),
          AsyncStorage.getItem(LEGACY_KEYS.SETTINGS),
        ]);

        if (rawAssets) {
          const assets: Asset[] = JSON.parse(rawAssets);
          for (const a of assets) {
            await db.runAsync(
              `INSERT OR IGNORE INTO ${TABLES.ASSETS}
               (id, type, subtype, name, quantity, unit, value, purchased_at, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)`,
              [a.id, a.type, a.subtype ?? null, a.name, a.quantity ?? null,
               a.unit ?? null, a.value ?? null, a.purchasedAt ?? null,
               a.createdAt, a.updatedAt ?? null]
            );
          }
        }

        if (rawDebts) {
          const debts: Debt[] = JSON.parse(rawDebts);
          for (const d of debts) {
            await db.runAsync(
              `INSERT OR IGNORE INTO ${TABLES.DEBTS}
               (id, direction, name, amount, note, people, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?)`,
              [d.id, d.direction, d.name, d.amount, d.note ?? null,
               JSON.stringify(d.people ?? []), d.createdAt, d.updatedAt ?? null]
            );
            for (const tx of d.transactions ?? []) {
              await db.runAsync(
                `INSERT OR IGNORE INTO ${TABLES.DEBT_TRANSACTIONS}
                 (id, debt_id, amount, date, note) VALUES (?,?,?,?,?)`,
                [tx.id, d.id, tx.amount, tx.date, tx.note]
              );
            }
          }
        }

        if (rawHistory) {
          const history: HistoryPoint[] = JSON.parse(rawHistory);
          for (const h of history) {
            await db.runAsync(
              `INSERT OR IGNORE INTO ${TABLES.HISTORY} (date, total) VALUES (?,?)`,
              [h.date, h.total]
            );
          }
        }

        if (rawSettings) {
          const settings = JSON.parse(rawSettings);
          for (const [key, val] of Object.entries(settings)) {
            await db.runAsync(
              `INSERT OR REPLACE INTO ${TABLES.SETTINGS} (key, value) VALUES (?,?)`,
              [key, JSON.stringify(val)]
            );
          }
        }

        await AsyncStorage.setItem(MIGRATION_FLAG, '1');
      } catch (e) {
        console.warn('[DbProvider] AsyncStorage migration failed:', e);
      }
    })();
  }, [db]);

  return <>{children}</>;
}

interface Props {
  children: React.ReactNode;
}

export default function DbProvider({ children }: Props) {
  return (
    <SQLiteProvider
      databaseName={DB_NAME}
      onInit={applyMigrations}
      useSuspense={false}
      onError={(e) => console.error('[DbProvider] SQLite init error:', e)}
    >
      <MigrationRunner>{children}</MigrationRunner>
    </SQLiteProvider>
  );
}
