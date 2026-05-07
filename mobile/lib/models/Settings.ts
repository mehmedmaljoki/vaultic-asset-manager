export interface Settings {
  currency: string;
  themeMode: 'light' | 'dark' | 'system';
  privacyMode: boolean;
  apiProvider: 'goldapi';
  apiKey: string;
  language: string;
  /** Set after the first-launch system-default sync. */
  firstLaunchDone: boolean;
  /** True once the onboarding wizard has been completed or skipped. */
  onboardingDone: boolean;
  /** True once the optional biometric lock prompt has been shown (regardless of choice). */
  lockOptInPromptShown: boolean;
  /** Whether the app should require biometric/device-lock unlock on launch & resume. */
  lockEnabled: boolean;
  /** Google Drive OAuth tokens for cloud backup. */
  gdriveAccessToken: string;
  gdriveRefreshToken: string;
  gdriveExpiresAt: number;
}

export const SETTINGS_DEFAULTS: Settings = {
  currency:    'EUR',
  themeMode:   'system',
  privacyMode: false,
  apiProvider: 'goldapi',
  apiKey:      '',
  language:    'en',
  firstLaunchDone:      false,
  onboardingDone:       false,
  lockOptInPromptShown: false,
  lockEnabled:          false,
  gdriveAccessToken:    '',
  gdriveRefreshToken:   '',
  gdriveExpiresAt:      0,
};
