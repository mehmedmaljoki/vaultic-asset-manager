import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
  type ReactNode,
} from 'react';
import { useColorScheme, I18nManager } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { LIGHT, DARK, type Theme } from './colors';
import { formatCurrency } from './utils/currency';
import { t as translate, LANGS, type LangCode } from './i18n';
import { dbGetSettings, dbSaveSettings } from './repositories/SettingsRepository';
import { applySystemDefaultsIfFirstLaunch } from './services/SystemDefaultsService';
import { getLockAvailability } from './services/LockService';
import { useAppLock } from './hooks/useAppLock';
import { LockScreen } from './components/LockScreen';
import { LockOptInPrompt } from './components/LockOptInPrompt';
import { SETTINGS_DEFAULTS, type Settings } from './models/Settings';
import { usePrices, type UsePricesResult } from './hooks/usePrices';
import { useFxRates } from './hooks/useFxRates';
import { dbGetAssets } from './repositories/AssetRepository';
import { dbGetHistory, dbUpsertDailyHistory } from './repositories/HistoryRepository';
import { getTotalWorth } from './services/AssetService';
import { shouldSnapshotToday } from './services/HistoryService';
import type { LivePrices } from './models/PriceMap';
import type { PriceSource } from './services/PriceService';
import type { FxSource } from './services/FxService';

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
  // FX rates: multiplier `amount * fxRates[currency] = amount in settings.currency`.
  // fxRates[settings.currency] is always 1.
  fxRates:  Record<string, number>;
  fxSource: FxSource | null;
  // Data lifecycle — bumped on Clear/Import so dependent hooks reload
  dataVersion: number;
  notifyDataChanged: () => Promise<void>;
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
  const [dataVersion, setDataVersion] = useState(0);
  const [showLockOptIn, setShowLockOptIn] = useState(false);

  useEffect(() => {
    (async () => {
      let s = SETTINGS_DEFAULTS;
      try {
        await applySystemDefaultsIfFirstLaunch(db);
        s = await dbGetSettings(db);
        setSettings(s);
      } catch (e) {
        console.error('[AppContext] settings load failed:', e);
      } finally {
        setLoaded(true);
      }
      if (!s.lockOptInPromptShown && !s.lockEnabled) {
        try {
          const avail = await getLockAvailability();
          if (avail.available) {
            setShowLockOptIn(true);
          } else if (avail.reason !== 'no_module') {
            // Hardware confirmed absent → dismiss permanently so we don't ask again.
            // If reason is 'no_module' we leave the flag unset so the prompt
            // appears after a proper native rebuild with expo-local-authentication.
            await dbSaveSettings(db, { lockOptInPromptShown: true });
            setSettings(prev => ({ ...prev, lockOptInPromptShown: true }));
          }
        } catch { /* swallow — opt-in is best-effort */ }
      }
    })();
  }, [db]);

  const patchSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch } as Settings;
    setSettings(next);
    await dbSaveSettings(db, patch);
  }, [db, settings]);

  const notifyDataChanged = useCallback(async () => {
    const fresh = await dbGetSettings(db);
    setSettings(fresh);
    setDataVersion(v => v + 1);
  }, [db]);

  const priceResult: UsePricesResult = usePrices(settings, dataVersion);
  const fxResult = useFxRates(settings, dataVersion);

  const dailySnapRan = useRef(false);
  useEffect(() => {
    const prices = priceResult.prices;
    // Only snapshot once we actually have prices (so the total is meaningful).
    if (dailySnapRan.current) return;
    if (!prices || Object.keys(prices).length === 0) return;
    dailySnapRan.current = true;
    (async () => {
      try {
        const [assets, history] = await Promise.all([
          dbGetAssets(db),
          dbGetHistory(db, 730),
        ]);
        const nowIso = new Date().toISOString();
        if (shouldSnapshotToday(history, nowIso)) {
          const total = getTotalWorth(assets, prices, fxResult.rates ?? {});
          await dbUpsertDailyHistory(db, total, nowIso);
        }
      } catch {
        // non-fatal — history is best-effort
      }
    })();
  }, [db, priceResult.prices, fxResult.rates]);

  const { locked, unlock } = useAppLock(settings.lockEnabled);

  const handleOptInEnable = useCallback(async () => {
    setShowLockOptIn(false);
    const ok = await unlock(translate('lock_unlock_reason', (settings.language as LangCode) ?? 'en'));
    const patch: Partial<Settings> = ok
      ? { lockEnabled: true, lockOptInPromptShown: true }
      : { lockOptInPromptShown: true };
    await patchSettings(patch);
  }, [unlock, settings.language, patchSettings]);

  const handleOptInLater = useCallback(async () => {
    setShowLockOptIn(false);
    await patchSettings({ lockOptInPromptShown: true });
  }, [patchSettings]);

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
      fxRates:         fxResult.rates,
      fxSource:        fxResult.source,
      dataVersion, notifyDataChanged,
    }}>
      {locked ? <LockScreen onUnlock={unlock} th={th} t={t} /> : children}
      <LockOptInPrompt
        visible={showLockOptIn}
        onEnable={handleOptInEnable}
        onLater={handleOptInLater}
        th={th}
        t={t}
      />
    </Ctx.Provider>
  );
}

// ── Public provider ───────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  return <AppProviderInner>{children}</AppProviderInner>;
}
