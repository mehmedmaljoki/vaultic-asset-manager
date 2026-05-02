export interface Settings {
  currency: string;
  themeMode: 'light' | 'dark' | 'system';
  privacyMode: boolean;
  apiProvider: 'goldapi';
  apiKey: string;
  language: string;
}

export const SETTINGS_DEFAULTS: Settings = {
  currency:    'EUR',
  themeMode:   'system',
  privacyMode: false,
  apiProvider: 'goldapi',
  apiKey:      '',
  language:    'en',
};
