import { type Page, type BrowserContext, chromium } from '@playwright/test';

/**
 * Logs in to SharePoint Online via the Microsoft 365 login flow.
 * Assumes MFA is disabled for the test account.
 */
export async function loginToSharePoint(
  page: Page,
  url: string,
  username: string,
  password: string
): Promise<void> {
  // Navigate to the SharePoint URL, which redirects to login.microsoftonline.com
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for and fill the username/email field
  const emailInput = page.locator('#i0116');
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(username);
  await page.locator('#idSIButton9').click();

  // Wait for the password view to appear (the username view must transition first)
  const passwordInput = page.locator('input[name="passwd"]:visible');
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.fill(password);
  await page.locator('#idSIButton9').click();

  // Handle the "Stay signed in?" prompt by clicking "No"
  try {
    const staySignedInNo = page.locator('#idBtn_Back');
    await staySignedInNo.waitFor({ state: 'visible', timeout: 10000 });
    await staySignedInNo.click();
  } catch {
    // The prompt may not appear in all tenants; continue silently
  }

  // Wait for the redirect back to SharePoint and for the page to settle
  await page.waitForURL(/.*sharepoint\.com.*/, { timeout: 60000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Global setup helper that performs login once and persists the authenticated
 * browser state to `storageStatePath`. Reference this file in your Playwright
 * config's `globalSetup` so individual tests reuse the session without
 * re-authenticating.
 *
 * Required environment variables:
 *  - M365_TEST_USERNAME
 *  - M365_TEST_PASSWORD
 */
export async function globalAuthSetup(
  siteUrl: string,
  storageStatePath: string
): Promise<void> {
  const username = process.env.M365_TEST_USERNAME;
  const password = process.env.M365_TEST_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Environment variables M365_TEST_USERNAME and M365_TEST_PASSWORD must be set'
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginToSharePoint(page, siteUrl, username, password);
    await context.storageState({ path: storageStatePath });
  } catch (error) {
    console.error('Auth failed. Current URL:', page.url());
    const html = await page.content();
    console.error('Page HTML:\n', html);
    throw error;
  } finally {
    await browser.close();
  }
}
