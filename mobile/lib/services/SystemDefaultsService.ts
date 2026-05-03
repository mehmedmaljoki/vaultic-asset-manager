import type { SQLiteDatabase } from 'expo-sqlite';
import { dbGetSettings, dbSaveSettings } from '../repositories/SettingsRepository';
import type { Settings } from '../models/Settings';
import type { LangCode } from '../i18n';

const SUPPORTED: LangCode[] = [
  'en','de','ar','tr','sr','bs','hr','es','fr','nl','zh','hi','ru','id','ms','fa',
];

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

/**
 * On first launch only: copy the device's preferred language into settings
 * and mark `firstLaunchDone`. Theme stays on `'system'` so it tracks the OS
 * automatically — no patch needed there. Returns the patch that was applied,
 * or `null` if no work was needed.
 */
export async function applySystemDefaultsIfFirstLaunch(
  db: SQLiteDatabase,
): Promise<Partial<Settings> | null> {
  const cur = await dbGetSettings(db);
  if (cur.firstLaunchDone) return null;
  const patch: Partial<Settings> = {
    language:        getSystemLanguage(),
    themeMode:       'system',
    firstLaunchDone: true,
  };
  await dbSaveSettings(db, patch);
  return patch;
}
