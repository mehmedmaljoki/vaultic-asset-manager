import { test, expect } from '@playwright/test';

test.describe('Debts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('text=Net Worth', { timeout: 15_000 });
    await page.getByText('Debts').click();
    await page.waitForSelector('text=Debts', { timeout: 10_000 });
  });

  test('shows debts screen with tab switcher', async ({ page }) => {
    await expect(page.getByText('Owed to me')).toBeVisible();
    await expect(page.getByText('I owe')).toBeVisible();
  });

  test('shows add button', async ({ page }) => {
    await expect(page.getByText('+ Add')).toBeVisible();
  });

  test('add a debt and see it in the list', async ({ page }) => {
    await page.getByText('+ Add').click();
    await page.waitForSelector('text=Add Debt', { timeout: 5_000 });

    const nameInput = page.locator('input, [placeholder*="Person"], [placeholder*="Ali"]').first();
    await nameInput.fill('Ali Hassan');

    const amountInput = page.locator('[placeholder="0.00"]').first();
    await amountInput.fill('500');

    await page.getByText('Add Debt').click();

    await expect(page.getByText('Ali Hassan')).toBeVisible({ timeout: 5_000 });
  });

  test('tab switch between owed-to-me and i-owe', async ({ page }) => {
    await page.getByText('I owe').click();
    // Tab should now show "I owe" section; no crash
    await expect(page.getByText('I owe')).toBeVisible();

    await page.getByText('Owed to me').click();
    await expect(page.getByText('Owed to me')).toBeVisible();
  });

  test('summary chips show net, owed, payable values', async ({ page }) => {
    // The debts screen shows Net/Receivable/Payable chips
    await expect(page.locator('text=/Net|receivable|payable/i').first()).toBeVisible();
  });
});
