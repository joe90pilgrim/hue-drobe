import { expect, test, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import { addToWardrobe, card, closeSlot, inWardrobe, openSlot, seedStore, setColour } from './helpers';

// V2-06b: each person's data follows them between devices. Two browser contexts stand in for the phone and the laptop.
// The server is a stand-in kept in the test (the real one has its own tests in deploy/sync.test.mjs); it does what the real
// one does: one copy per person and key, a new update time on every write.

type Copy = { value: unknown; updatedAt: string };

function fakeServer() {
  const data: Record<string, Record<string, Copy>> = {};
  let tick = 0;
  const state = { unreachable: false };
  const handler = (person: string) => async (route: Route) => {
    if (state.unreachable) return route.abort('internetdisconnected');
    const req = route.request();
    const url = new URL(req.url());
    const mine = (data[person] ??= {});
    if (req.method() === 'GET' && url.pathname.endsWith('/api/data')) return route.fulfill({ json: { data: mine } });
    if (req.method() === 'PUT') {
      const key = url.pathname.split('/').pop()!;
      const updatedAt = new Date(Date.UTC(2026, 10, 16, 20, 0, 0, ++tick)).toISOString();
      mine[key] = { value: (req.postDataJSON() as { value: unknown }).value, updatedAt };
      return route.fulfill({ json: { updatedAt } });
    }
    return route.fulfill({ status: 405 });
  };
  return { data, state, handler };
}

type Server = ReturnType<typeof fakeServer>;

/** A device signed in as `person`, talking to `server`. Service workers are off so the test sees every request. */
async function device(browser: Browser, server: Server, person = 'joe'): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 412, height: 915 }, hasTouch: true });
  await context.route('**/api/me', (r) => r.fulfill({ json: { person } }));
  await context.route(/\/api\/data(\/|$)/, server.handler(person));
  return { context, page: await context.newPage() };
}

const wardrobeOnServer = (server: Server, person = 'joe') => () => (server.data[person]?.wardrobe?.value as { name: string }[] | undefined)?.map((i) => i.name) ?? [];

async function addNavyTee(page: Page) {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await setColour(page, '#1f2a5a');
  await addToWardrobe(page).click();
  await expect(inWardrobe(page)).toBeVisible();
}

test('a change on the phone shows on the laptop after a reload', async ({ browser }) => {
  const server = fakeServer();
  const phone = await device(browser, server);
  const laptop = await device(browser, server);

  await addNavyTee(phone.page);
  await expect.poll(wardrobeOnServer(server)).toEqual(['Navy tee']);

  await laptop.page.goto('/#/wardrobe');
  await expect(card(laptop.page, 'Navy tee')).toBeVisible();
  await phone.context.close();
  await laptop.context.close();
});

test('an open app takes a change from the other device when it comes back into view', async ({ browser }) => {
  const server = fakeServer();
  const phone = await device(browser, server);
  const laptop = await device(browser, server);

  await laptop.page.goto('/#/wardrobe');
  await expect(laptop.page.getByRole('tab', { name: /^Clothes · 0$/ })).toBeVisible();
  await addNavyTee(phone.page);
  await expect.poll(wardrobeOnServer(server)).toEqual(['Navy tee']);

  await laptop.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(card(laptop.page, 'Navy tee')).toBeVisible();
  await phone.context.close();
  await laptop.context.close();
});

test("a change from the other device never closes a panel that is open; it shows once the panel is closed", async ({ browser }) => {
  const server = fakeServer();
  const phone = await device(browser, server);
  const laptop = await device(browser, server);

  await laptop.page.goto('/#/try-on');
  await openSlot(laptop.page, 'Top');
  await addNavyTee(phone.page);
  await expect.poll(wardrobeOnServer(server)).toEqual(['Navy tee']);
  await laptop.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await laptop.page.waitForTimeout(2000);
  await expect(laptop.page.getByRole('dialog', { name: 'Top' })).toBeVisible();

  await closeSlot(laptop.page);
  await laptop.page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(card(laptop.page, 'Navy tee')).toBeVisible();
  await phone.context.close();
  await laptop.context.close();
});

test('a change made offline is sent once back online', async ({ browser }) => {
  const server = fakeServer();
  const phone = await device(browser, server);

  server.state.unreachable = true;
  await phone.page.goto('/#/try-on');
  await openSlot(phone.page, 'Top');
  await setColour(phone.page, '#1f2a5a');
  const failedRound = phone.page.waitForEvent('requestfailed', (r) => r.url().includes('/api/data')); // the first round after the save fails; the save stays marked
  await addToWardrobe(phone.page).click();
  await expect(inWardrobe(phone.page)).toBeVisible();
  await failedRound;
  expect(wardrobeOnServer(server)()).toEqual([]);

  server.state.unreachable = false;
  await phone.page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(wardrobeOnServer(server)).toEqual(['Navy tee']);
  await phone.context.close();
});

test("data saved before sync existed is sent on the first sync, and the server's copy is not overwritten later", async ({ browser }) => {
  const server = fakeServer();
  const phone = await device(browser, server);
  await phone.page.goto('/#/wardrobe');
  await seedStore(phone.page, { wardrobe: [{ v: 2, id: 'old', garment: 'tee', neckline: 'crew', colour: '#336699', name: 'Old tee', savedAt: 1 }] });
  await phone.page.reload();
  await expect.poll(wardrobeOnServer(server)).toEqual(['Old tee']);

  // The laptop changes the wardrobe; the phone, on its next start, takes that instead of sending its old copy again.
  const laptop = await device(browser, server);
  await addNavyTee(laptop.page);
  await expect.poll(wardrobeOnServer(server)).toEqual(['Old tee', 'Navy tee']);
  await phone.page.reload();
  await expect(card(phone.page, 'Navy tee')).toBeVisible();
  expect(wardrobeOnServer(server)()).toEqual(['Old tee', 'Navy tee']);
  await phone.context.close();
  await laptop.context.close();
});

test("one person's changes never reach the other", async ({ browser }) => {
  const server = fakeServer();
  const joe = await device(browser, server, 'joe');
  const b = await device(browser, server, 'b');
  await addNavyTee(joe.page);
  await expect.poll(wardrobeOnServer(server, 'joe')).toEqual(['Navy tee']);
  await b.page.goto('/#/wardrobe');
  await expect(b.page.getByRole('tab', { name: /^Clothes · 0$/ })).toBeVisible();
  expect(server.data.b?.wardrobe).toBeUndefined();
  await joe.context.close();
  await b.context.close();
});
