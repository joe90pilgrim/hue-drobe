import type { Page } from '@playwright/test';

/** Opens every collapsed "What you're wearing" row so a test can reach the slot controls (V1.2-03; V1.2-04 replaces them with a sheet). */
export async function openRows(page: Page) {
  await page.locator('.wear-row').first().waitFor({ state: 'attached', timeout: 2000 }).catch(() => {});
  const closed = page.locator('.wear-row[aria-expanded="false"]');
  while ((await closed.count()) > 0) await closed.first().click();
}
