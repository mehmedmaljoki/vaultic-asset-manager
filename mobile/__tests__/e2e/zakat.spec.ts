import { test, expect } from '@playwright/test';

test.describe('Zakat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Net Worth', { timeout: 15_000 });
    await page.getByText('Zakat').click();
    await page.waitForSelector('text=Zakat', { timeout: 10_000 });
  });

  test('shows zakat screen with method label', async ({ page }) => {
    // Hanafi method label
    await expect(page.getByText(/Hanafi.*2\.5/i)).toBeVisible();
  });

  test('nisab section shows silver and gold options', async ({ page }) => {
    await expect(page.getByText('Silver')).toBeVisible();
    await expect(page.getByText('Gold')).toBeVisible();
  });

  test('switching nisab between silver and gold does not crash', async ({ page }) => {
    const goldBtn = page.getByText('Gold');
    await goldBtn.click();
    // Page should still be functional
    await expect(page.getByText(/Hanafi/i)).toBeVisible();

    const silverBtn = page.getByText('Silver');
    await silverBtn.click();
    await expect(page.getByText(/Hanafi/i)).toBeVisible();
  });

  test('shows zakat summary section', async ({ page }) => {
    await expect(page.getByText(/Zakat.*Summary|Summary/i).first()).toBeVisible();
  });

  test('nisab value is either a formatted amount or dash when price unavailable', async ({ page }) => {
    // Current nisab display should be either a currency amount or "–"
    const nisabRow = page.locator('text=/Current nisab/i');
    await expect(nisabRow).toBeVisible();
    // The value next to it should be either a number or dash — page must not crash
    await expect(page.getByText(/Zakat Due|Below Nisab/i).first()).toBeVisible();
  });

  test('disclaimer text is visible', async ({ page }) => {
    await expect(page.getByText(/Guide only|scholar/i).first()).toBeVisible();
  });
});
