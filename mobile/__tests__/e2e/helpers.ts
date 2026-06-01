import { type Page, expect } from '@playwright/test';

/**
 * Load the app and dismiss the onboarding flow so tests land on the tabs.
 *
 * A fresh web profile starts with `onboardingDone = false`, so the app shows the
 * onboarding carousel first. We tap "Skip" to reach the dashboard. Tests run with
 * the `en-US` locale (see playwright.config.ts), so UI strings are English.
 */
export async function gotoApp(page: Page): Promise<void> {
  // Wait only for the initial HTML, not the full `load` event: a React Native Web
  // SPA keeps connections open (HMR socket, price fetches) so `load`/`networkidle`
  // may never settle even though the app is interactive.
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Either onboarding ("Skip") or — if already onboarded — the dashboard appears.
  // The dashboard heading is rendered uppercased ("NET WORTH") via textTransform,
  // so match case-insensitively.
  const skip = page.getByText('Skip', { exact: true });
  const netWorth = page.getByText(/net worth/i);

  await expect(skip.or(netWorth).first()).toBeVisible({ timeout: 30_000 });

  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  }

  // Dashboard is ready once the net-worth heading is shown.
  await expect(netWorth.first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Navigate to a bottom-tab by its label. Expo Router renders the tab bar as a
 * `tablist` of `tab` roles; the accessible name includes a leading icon glyph,
 * so match the label loosely.
 */
export async function openTab(page: Page, label: string): Promise<void> {
  await page.getByRole('tab', { name: new RegExp(label, 'i') }).first().click();
}
