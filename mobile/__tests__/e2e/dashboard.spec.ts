import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('shows net worth heading', async ({ page }) => {
    await expect(page.getByText(/net worth/i).first()).toBeVisible();
  });

  test('shows the bottom nav tabs', async ({ page }) => {
    // Tab bar is a `tablist` of `tab` roles; names include a leading icon glyph.
    for (const label of ['Overview', 'Assets', 'Zakat', 'Debts', 'Settings']) {
      await expect(
        page.getByRole('tab', { name: new RegExp(label, 'i') }).first(),
      ).toBeVisible();
    }
  });

  test('live prices section is visible', async ({ page }) => {
    await expect(page.getByText(/live prices/i).first()).toBeVisible();
  });

  test('price source badge is shown when prices loaded', async ({ page }) => {
    // Allow extra time for price fetch or cache read.
    await page.waitForTimeout(3_000);
    // Badge shows LIVE, CACHED, PARTIAL, or OFFLINE — any of these is correct.
    await expect(page.locator('text=/LIVE|CACHED|PARTIAL|OFFLINE/').first()).toBeVisible();
  });

  test('breakdown section is present', async ({ page }) => {
    await expect(page.getByText(/breakdown/i).first()).toBeVisible();
  });
});
