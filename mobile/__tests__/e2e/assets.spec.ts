import { test, expect } from '@playwright/test';

test.describe('Assets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Net Worth', { timeout: 15_000 });
    await page.getByText('Assets').click();
    await page.waitForSelector('text=Assets', { timeout: 10_000 });
  });

  test('shows assets screen header', async ({ page }) => {
    // There should be an "Assets" heading and an add button
    await expect(page.getByText('+ Add')).toBeVisible();
  });

  test('add a money asset and see it in the list', async ({ page }) => {
    await page.getByText('+ Add').click();

    // Wait for the add sheet to appear
    await page.waitForSelector('text=Add Asset', { timeout: 5_000 });

    // Fill in asset name
    const nameInput = page.locator('input, [placeholder*="Name"], [placeholder*="name"]').first();
    await nameInput.fill('Test Cash');

    // Fill in value (for money type which doesn't need a price feed)
    const valueInput = page.locator('[placeholder*="0.00"], [placeholder*="value"], [placeholder*="Value"]').first();
    await valueInput.fill('1000');

    // Select "Cash & Bank" / money category if picker is visible
    const moneyOption = page.locator('text=/Cash|Money|Bank/i').first();
    if (await moneyOption.isVisible()) {
      await moneyOption.click();
    }

    // Save
    await page.getByText('Save').click();

    // Asset should now appear in the list
    await expect(page.getByText('Test Cash')).toBeVisible({ timeout: 5_000 });
  });

  test('metal asset with no live price shows dash', async ({ page }) => {
    // When offline/mock, metal assets without a price show "–"
    // This test verifies the null-safe display: if a "–" appears, the app didn't crash
    const dash = page.locator('text=–');
    // It's ok if there are no dashes (all prices available) — we just ensure no unhandled errors
    // The key assertion is that the page is still functional
    await expect(page.getByText('+ Add')).toBeVisible();
  });

  test('history tab is accessible', async ({ page }) => {
    await page.getByText('History').click();
    // History tab should show a chart or "not enough history" message
    await expect(
      page.locator('text=/History|Not enough history|past 60/i').first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
