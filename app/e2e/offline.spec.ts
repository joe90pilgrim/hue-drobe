import { existsSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Offline start (V2-06 phone check): with no network the installed app must open from its cache quickly, avatar included.
// A phone in aeroplane mode can leave requests hanging rather than failing, so both cases are tested.
// Needs Joe's private avatar pack, which the preview server serves from private/pack/joe/.
test.skip(!existsSync(new URL('../../private/pack/joe/body.glb', import.meta.url)), 'needs the private avatar pack');

/** The longest an offline start may take, from reload to the avatar showing. */
const OFFLINE_START_MS = 6000;

const avatarShown = (page: Page) => page.getByText('Drag to turn', { exact: false });

async function loadOnlineOnce(page: Page) {
  await page.goto('/#/try-on');
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await expect(avatarShown(page)).toBeVisible({ timeout: 20_000 });
}

async function timeOfflineStart(page: Page) {
  const t0 = Date.now();
  await page.reload({ waitUntil: 'commit', timeout: 30_000 });
  await expect(avatarShown(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('data-person', 'joe');
  return Date.now() - t0;
}

/** Every request, from the page or the service worker, waits forever, as on a phone whose network never answers. */
const hangNetwork = (context: BrowserContext) => context.route('**/*', () => {});

test('offline (requests fail at once): opens as Joe with his avatar quickly', async ({ page, context }) => {
  await loadOnlineOnce(page);
  await context.setOffline(true);
  const ms = await timeOfflineStart(page);
  console.log(`offline start, failing network: ${ms} ms`);
  expect(ms).toBeLessThan(OFFLINE_START_MS);
});

test('offline (requests hang): opens as Joe with his avatar quickly', async ({ page, context }) => {
  await loadOnlineOnce(page);
  await hangNetwork(context);
  const ms = await timeOfflineStart(page);
  console.log(`offline start, hanging network: ${ms} ms`);
  expect(ms).toBeLessThan(OFFLINE_START_MS);
});
