import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react';
import { useColorScheme, I18nManager } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { LIGHT, DARK, type Theme } from './colors';
import { formatCurrency } from './utils/currency';
import { t as translate, LANGS, type LangCode } from './i18n';
import { dbGetSettings, dbSaveSettings } from './repositories/SettingsRepository';
import { SETTINGS_DEFAULTS, type Settings } from './models/Settings';
import { usePrices, type UsePricesResult } from './hooks/usePrices';
import type { LivePrices } from './models/PriceMap';
import type { PriceSource } from './services/PriceService';

// ── Context shape ─────────────────────────────────────────────────────────────
interface AppCtx {
  th: Theme;
  isDark: boolean;
  t: (key: string) => string;
  language: LangCode;
  dir: 'ltr' | 'rtl';
  currency: string;
  fmt: (n: number) => string;
  privacyMode: boolean;
  settings: Settings;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
  // Live prices
  prices:     Partial<LivePrices>;
  priceSource: PriceSource | null;
  priceAgeMinutes: number | null;
  priceLoading: boolean;
  refreshPrices: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// ── Inner provider (needs SQLite context) ─────────────────────────────────────
function AppProviderInner({ children }: { children: ReactNode }) {
  const db            = useSQLiteContext();
  const systemScheme  = useColorScheme();

  const [settings, setSettings] = useState<Settings>(SETTINGS_DEFAULTS);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    dbGetSettings(db).then(s => { setSettings(s); setLoaded(true); });
  }, [db]);

  const patchSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch } as Settings;
    setSettings(next);
    await dbSaveSettings(db, patch);
  }, [db, settings]);

  const priceResult: UsePricesResult = usePrices(settings);

  const isDark =
    settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' && systemScheme === 'dark');

  const th       = isDark ? DARK : LIGHT;
  const language = (settings.language as LangCode) ?? 'en';
  const dir      = LANGS.find(l => l.code === language)?.dir ?? 'ltr';

  const t   = useCallback((key: string) => translate(key, language), [language]);
  const fmt = useCallback(
    (n: number) => formatCurrency(n, settings.currency),
    [settings.currency],
  );

  if (!loaded) return null;

  return (
    <Ctx.Provider value={{
      th, isDark,
      t, language, dir,
      currency: settings.currency, fmt,
      privacyMode: settings.privacyMode,
      settings, patchSettings,
      prices:          priceResult.prices,
      priceSource:     priceResult.source,
      priceAgeMinutes: priceResult.ageMinutes,
      priceLoading:    priceResult.loading,
      refreshPrices:   priceResult.refresh,
    }}>
      {children}
    </Ctx.Provider>
  );
}

// ── Public provider ───────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  return <AppProviderInner>{children}</AppProviderInner>;
}
