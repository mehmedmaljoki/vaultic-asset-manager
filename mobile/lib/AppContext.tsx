import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react';
import { useColorScheme, I18nManager } from 'react-native';
import { LIGHT, DARK, type Theme } from './colors';
import { getSettings, saveSettings, formatCurrency, type Settings } from './data';
import { t as translate, LANGS, type LangCode } from './i18n';

// ── Context shape ─────────────────────────────────────────────────────────────
interface AppCtx {
  // Theme
  th: Theme;
  isDark: boolean;
  // Translations
  t: (key: string) => string;
  language: LangCode;
  dir: 'ltr' | 'rtl';
  // Currency
  currency: string;
  fmt: (n: number) => string;
  // Privacy
  privacyMode: boolean;
  // Settings mutation
  settings: Settings;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();

  const [settings, setSettings] = useState<Settings>({
    currency:    'EUR',
    themeMode:   'system',
    privacyMode: false,
    apiProvider: 'mock',
    apiKey:      '',
    language:    'en',
  });

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then(s => { setSettings(s); setLoaded(true); });
  }, []);

  const patchSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch } as Settings;
    setSettings(next);
    await saveSettings(patch);
  }, [settings]);

  // Derived values
  const isDark =
    settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' && systemScheme === 'dark');

  const th = isDark ? DARK : LIGHT;

  const language = (settings.language as LangCode) ?? 'en';
  const dir = LANGS.find(l => l.code === language)?.dir ?? 'ltr';

  const t = useCallback((key: string) => translate(key, language), [language]);

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
    }}>
      {children}
    </Ctx.Provider>
  );
}
