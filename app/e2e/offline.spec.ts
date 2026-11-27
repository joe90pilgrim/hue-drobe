import { existsSync } from 'node:fs';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

// Offline start (V2-06 phone check): with no network the installed app must open from its cache quickly, avatar included.
// A phone in aeroplane mode can leave requests hanging rather than failing, so both cases are tested.
// Runs with a service worker (the rest of the suite blocks them). The preview server serves the placeholder pack by default,
// and Joe's real pack from private/pack/joe/ under `npm run check:private`.
test.use({ serviceWorkers: 'allow' });
test.skip(!!process.env.E2E_PRIVATE_PACK && !existsSync(new URL('../../private/pack/joe/body.glb', import.meta.url)), 'needs the private avatar pack');

/** The longest an offline start may take, from reload to the avatar showing. */
const OFFLINE_START_MS = 6000;

const avatarShown = (page: Page) => page.getByText('Drag to turn', { exact: false });
/** V8-01: Try On opens on the 2D doll; the turn hint, the sign that the avatar has loaded, shows only in 3D. */
const show3D = (page: Page) => page.getByRole('radio', { name: '3D' }).click();

async function loadOnlineOnce(page: Page) {
  await page.goto('/#/try-on');
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  await show3D(page);
  await expect(avatarShown(page)).toBeVisible({ timeout: 20_000 });
}

async function timeOfflineStart(page: Page) {
  const t0 = Date.now();
  await page.reload({ waitUntil: 'commit', timeout: 30_000 });
  await show3D(page);
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
