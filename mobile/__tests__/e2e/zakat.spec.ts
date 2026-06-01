import { test, expect } from '@playwright/test';
import { gotoApp, openTab } from './helpers';

test.describe('Zakat', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await openTab(page, 'Zakat');
    // Hanafi method label confirms the Zakat screen is shown.
    await expect(page.getByText(/Hanafi/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows zakat screen with method label', async ({ page }) => {
    await expect(page.getByText(/Hanafi.*2\.5/i).first()).toBeVisible();
  });

  test('nisab section shows silver and gold options', async ({ page }) => {
    await expect(page.getByText('Silver', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Gold', { exact: true }).first()).toBeVisible();
  });

  test('switching nisab between silver and gold does not crash', async ({ page }) => {
    await page.getByText('Gold', { exact: true }).first().click();
    await expect(page.getByText(/Hanafi/i).first()).toBeVisible();

    await page.getByText('Silver', { exact: true }).first().click();
    await expect(page.getByText(/Hanafi/i).first()).toBeVisible();
  });

  test('shows the asset-categories section', async ({ page }) => {
    // With no assets there is no "Zakat Summary" receipt; the Asset Categories
    // section is always rendered.
    await expect(page.getByText(/Asset Categories/i).first()).toBeVisible();
  });

  test('nisab value is a formatted amount or dash when price unavailable', async ({ page }) => {
    await expect(page.getByText(/Current nisab/i).first()).toBeVisible();
    // The computed result row must render (amount or "Below Nisab") without crashing.
    await expect(page.getByText(/Zakat Due|Below Nisab/i).first()).toBeVisible();
  });

  test('disclaimer text is visible in the About modal', async ({ page }) => {
    // The scholar disclaimer lives inside the "About" modal, opened from the header.
    await page.getByText('About', { exact: true }).first().click();
    await expect(page.getByText(/guide only|scholar/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
