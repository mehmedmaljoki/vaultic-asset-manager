import type { SQLiteDatabase } from 'expo-sqlite';
import { dbGetSettings, dbSaveSettings } from '../repositories/SettingsRepository';
import type { Settings } from '../models/Settings';
import type { LangCode } from '../i18n';
import { CURRENCIES } from '../models/Currency';

const SUPPORTED: LangCode[] = [
  'en','de','ar','tr','sr','bs','hr','es','fr','nl','zh','hi','ru','id','ms','fa',
];

const SUPPORTED_CURRENCIES = CURRENCIES.map(c => c.code);

/**
 * Resolve the device's preferred language code without hard-depending on
 * `expo-localization` at import time. The dep is optional in this repo
 * (added by the cloud-build profile) — when missing we fall back to 'en'.
 */
export function getSystemLanguage(): LangCode {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = require('expo-localization') as
      | { getLocales?: () => { languageCode?: string }[] }
      | undefined;
    const code = Localization?.getLocales?.()?.[0]?.languageCode;
    if (code && (SUPPORTED as string[]).includes(code)) return code as LangCode;
  } catch {
    // module not installed in this build — fall through to 'en'
  }
  return 'en';
}

/** Resolve the device's currency code; falls back to 'EUR' if unsupported. */
export function getSystemCurrency(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = require('expo-localization') as
      | { getLocales?: () => { currencyCode?: string }[] }
      | undefined;
    const code = Localization?.getLocales?.()?.[0]?.currencyCode;
    if (code && SUPPORTED_CURRENCIES.includes(code)) return code;
  } catch {
    // fall through
  }
  return 'EUR';
}

/**
 * On first launch only: copy the device's preferred language and currency into
 * settings and mark `firstLaunchDone`. Returns the patch applied, or `null` if
 * no work was needed.
 */
export async function applySystemDefaultsIfFirstLaunch(
  db: SQLiteDatabase,
): Promise<Partial<Settings> | null> {
  const cur = await dbGetSettings(db);
  if (cur.firstLaunchDone) return null;
  const patch: Partial<Settings> = {
    language:        getSystemLanguage(),
    currency:        getSystemCurrency(),
    themeMode:       'system',
    firstLaunchDone: true,
  };
  await dbSaveSettings(db, patch);
  return patch;
}

/**
 * Unconditional system-defaults apply — used after clearAllData so the UI
 * updates live without requiring an app restart.
 */
export async function applySystemDefaults(
  db: SQLiteDatabase,
): Promise<Partial<Settings>> {
  const patch: Partial<Settings> = {
    language:        getSystemLanguage(),
    currency:        getSystemCurrency(),
    themeMode:       'system',
    firstLaunchDone: true,
  };
  await dbSaveSettings(db, patch);
  return patch;
}
