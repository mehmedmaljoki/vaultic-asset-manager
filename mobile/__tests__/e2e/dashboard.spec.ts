import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to finish loading (DbProvider + AppProvider)
    await page.waitForSelector('[data-testid="dashboard-root"], text=Net Worth', { timeout: 15_000 });
  });

  test('shows net worth heading', async ({ page }) => {
    // The dashboard renders a "Net Worth" label (or its i18n equivalent for 'en')
    await expect(page.getByText('Net Worth')).toBeVisible();
  });

  test('shows at least one tab in the bottom nav', async ({ page }) => {
    // Expo Router tab bar should have Assets, Zakat, Debts, Settings
    await expect(page.getByText('Assets')).toBeVisible();
    await expect(page.getByText('Zakat')).toBeVisible();
    await expect(page.getByText('Debts')).toBeVisible();
    await expect(page.getByText('Settings')).toBeVisible();
  });

  test('live prices section is visible', async ({ page }) => {
    await expect(page.getByText(/LIVE PRICES/i)).toBeVisible();
  });

  test('price source badge is shown when prices loaded', async ({ page }) => {
    // Allow extra time for price fetch or cache read
    await page.waitForTimeout(3_000);
    // Badge shows LIVE, CACHED, PARTIAL, or OFFLINE — any of these is correct
    const badge = page.locator('text=/LIVE|CACHED|PARTIAL|OFFLINE/');
    await expect(badge.first()).toBeVisible();
  });

  test('breakdown section is present', async ({ page }) => {
    await expect(page.getByText('Breakdown')).toBeVisible();
  });
});
