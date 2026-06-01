import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  // Generous per-test timeout: the first navigation triggers a cold web-bundle
  // build which can take well over 30s.
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    // Force English so the app's locale-driven UI strings match the assertions
    // below (the app copies the device/browser locale into settings on first launch).
    locale: 'en-US',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
