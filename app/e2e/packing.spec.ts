import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { seedStore, seedWardrobe } from './helpers';

const quizData = JSON.parse(readFileSync(new URL('../src/data/colour-quiz.json', import.meta.url), 'utf8'));
const FINISHED_QUIZ = {
  answers: Object.fromEntries(quizData.questions.map((q: { id: string; answers: { id: string }[] }) => [q.id, q.answers[0].id])),
  finishedAt: '2026-11-01T00:00:00.000Z',
};
const lisbon = { v: 1, id: 't-1', name: 'Lisbon weekend', starts: '2026-12-14', ends: '2026-12-16', entries: [], savedAt: 1 };

const tee = { v: 2, id: 'tee-1', garment: 'tee', colour: '#1f2a5a', name: 'Navy tee', savedAt: 1 };
const trousers = { v: 2, id: 'trousers-1', garment: 'trousers', colour: '#d6d6d6', name: 'Light grey trousers', savedAt: 2 };
const outfit = { v: 1, id: 'o-1', name: 'Work day', top: 'tee-1', bottom: 'trousers-1', savedAt: 3 };

test('makes a trip, adds clothes and an outfit, ticks them off, and keeps the list after a reload', async ({ page }) => {
  await page.goto('/#/try-on');
  await seedWardrobe(page, [tee, trousers], [outfit]);

  await page.getByRole('link', { name: 'Packing' }).click();
  await page.getByRole('button', { name: 'New trip' }).click();
  await page.getByLabel('Name').fill('Lisbon weekend');
  await page.getByLabel('Starts').fill('2026-12-14');
  await page.getByLabel('Ends').fill('2026-12-16');
  await page.getByRole('button', { name: 'Save trip' }).click();

  await expect(page.getByRole('heading', { name: 'Lisbon weekend' })).toBeVisible();
  await expect(page.locator('.p-detail .d-sub')).toHaveText('14 Dec – 16 Dec 2026');
  await expect(page.getByText('Nothing on the list yet')).toBeVisible();

  await page.getByRole('button', { name: 'Add items and outfits' }).click();
  await page.locator('.p-pick[data-kind="item"][data-id="tee-1"]').click();
  await expect(page.locator('.p-pick[data-kind="item"][data-id="tee-1"]')).toContainText('On the list');
  await page.getByRole('tab', { name: /^Outfits/ }).click();
  await page.locator('.p-pick[data-kind="outfit"][data-id="o-1"]').click();
  await page.getByRole('button', { name: /^Done/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  // The outfit brings its two garments (the tee is on the list once, not twice); the outfit itself is a planned look.
  await expect(page.locator('.p-count')).toHaveText('0 of 2 packed');
  const tile = (ref: string) => page.locator(`.p-tile[data-ref="${ref}"]`);
  await expect(page.locator('.p-tile')).toHaveCount(2);
  await expect(page.locator('[data-kind="outfit"].p-tile')).toHaveCount(0);
  await expect(page.locator('.p-look')).toHaveCount(1);
  await expect(page.locator('.p-look')).toContainText('Work day');
  await expect(page.locator('.p-look')).toContainText('0 of 2 pieces packed');
  await expect(page.locator('.p-look [data-slot]')).toHaveCount(2);
  expect(await page.locator('.p-look [data-slot]').evaluateAll((els) => els.map((e) => e.getAttribute('data-slot')))).toEqual(['top', 'bottom']);
  await expect(page.locator('.p-packed-btn')).toHaveCount(0);
  await expect(tile('tee-1').locator('svg path').first()).toHaveAttribute('fill', '#1f2a5a');
  await expect(tile('tee-1')).toHaveAttribute('aria-pressed', 'false');
  await expect(tile('tee-1')).toHaveAccessibleName(/not packed/);

  // Ticking a tile moves it to Packed (closed by default) and the look card counts it.
  await tile('tee-1').click();
  await expect(page.locator('.p-count')).toHaveText('1 of 2 packed');
  await expect(page.locator('.p-tile')).toHaveCount(1);
  await expect(page.locator('.p-look')).toContainText('1 of 2 pieces packed');
  await expect(page.locator('.p-packed-btn')).toHaveText('Packed 1');
  await page.locator('.p-packed-btn').click();
  await expect(tile('tee-1')).toHaveAttribute('aria-pressed', 'true');
  await tile('tee-1').click(); // unticking sends it back to To pack
  await expect(page.locator('.p-count')).toHaveText('0 of 2 packed');
  await expect(page.locator('.p-packed-btn')).toHaveCount(0);
  await tile('tee-1').click();
  await tile('trousers-1').click();
  await expect(page.locator('.p-count')).toHaveText('2 of 2 packed');
  await expect(page.getByRole('heading', { name: 'To pack' })).toHaveCount(0);
  await expect(page.locator('.p-look')).toContainText('2 of 2 pieces packed');
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noOverflow).toBe(true);

  await page.reload();
  await page.getByRole('button', { name: /Lisbon weekend/ }).click();
  await expect(page.locator('.p-count')).toHaveText('2 of 2 packed');
  await expect(page.locator('.p-packed-btn')).toHaveText('Packed 2'); // closed again after a reload
  await expect(page.locator('.p-tile')).toHaveCount(0);
  await page.locator('.p-packed-btn').click();
  await expect(page.locator('.p-tile[aria-pressed="true"]')).toHaveCount(2);
});

test('removing an outfit takes off only the garments it brought in, and old trips are backfilled once', async ({ page }) => {
  await page.goto('/#/packing');
  await seedStore(page, {
    wardrobe: [tee, trousers],
    outfits: [outfit],
    trips: [{ v: 1, id: 't-1', name: 'Old trip', starts: '2026-12-14', ends: '2026-12-16', entries: [{ kind: 'item', ref: 'tee-1', packed: false }, { kind: 'outfit', ref: 'o-1', packed: true }], savedAt: 1 }],
  });
  await page.reload();
  await page.getByRole('button', { name: /Old trip/ }).click();
  await expect(page.locator('.p-count')).toHaveText('2 of 2 packed');
  await page.getByRole('button', { name: 'Add items and outfits' }).click();
  await page.getByRole('tab', { name: /^Outfits/ }).click();
  await page.locator('.p-pick[data-kind="outfit"][data-id="o-1"]').click();
  await page.getByRole('button', { name: /^Done/ }).click();
  await expect(page.locator('.p-count')).toHaveText('1 of 1 packed');
  await expect(page.locator('.p-packed-btn')).toHaveText('Packed 1'); // the tee was packed, so it sits in the closed Packed section
  await page.locator('.p-packed-btn').click();
  await expect(page.locator('.p-tile[data-ref="tee-1"]')).toBeVisible();
  await expect(page.locator('.p-look')).toHaveCount(0);
});

test('the add picker filters clothes and outfits by a search, and keeps the search while ticking', async ({ page }) => {
  await page.goto('/#/packing');
  await seedStore(page, {
    wardrobe: [tee, trousers],
    outfits: [outfit],
    trips: [{ v: 1, id: 't-1', name: 'Lisbon weekend', starts: '2026-12-14', ends: '2026-12-16', entries: [], savedAt: 1 }],
  });
  await page.reload();
  await page.getByRole('button', { name: /Lisbon weekend/ }).click();
  await page.getByRole('button', { name: 'Add items and outfits' }).click();

  const search = page.getByLabel('Search');
  await search.fill('trou');
  await expect(page.locator('.p-pick[data-kind="item"][data-id="trousers-1"]')).toBeVisible();
  await expect(page.locator('.p-pick[data-kind="item"][data-id="tee-1"]')).toHaveCount(0);
  await page.getByRole('tab', { name: /^Outfits/ }).click();
  await expect(page.locator('.p-pick[data-kind="outfit"][data-id="o-1"]')).toHaveCount(1); // its piece is trousers
  await page.getByRole('tab', { name: /^Clothes/ }).click();

  await search.fill('zzz');
  await expect(page.getByText('Nothing matches')).toBeVisible();
  await page.getByRole('tab', { name: /^Outfits/ }).click();
  await expect(page.getByText('Nothing matches')).toBeVisible();
  await page.getByRole('tab', { name: /^Clothes/ }).click();

  await search.fill('navy');
  await page.locator('.p-pick[data-kind="item"][data-id="tee-1"]').click();
  await expect(search).toHaveValue('navy'); // ticking does not clear the search
  await expect(page.locator('.p-pick[data-kind="item"][data-id="trousers-1"]')).toHaveCount(0);
  await expect(page.locator('.p-pick[data-kind="item"][data-id="tee-1"]')).toContainText('On the list');
});

test("the add sheet: tapping an In an outfit tile makes it the trip's own, the footer counts entries, and nothing overflows at 412 px", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 800 });
  await page.goto('/#/packing');
  await seedStore(page, {
    wardrobe: [tee, trousers],
    outfits: [outfit],
    trips: [{ v: 1, id: 't-1', name: 'Lisbon weekend', starts: '2026-12-14', ends: '2026-12-16', entries: [], savedAt: 1 }],
  });
  await page.reload();
  await page.getByRole('button', { name: /Lisbon weekend/ }).click();
  await page.getByRole('button', { name: 'Add items and outfits' }).click();
  await expect(page.getByRole('button', { name: 'Done · 0 on the list' })).toBeVisible();

  await page.getByRole('tab', { name: /^Outfits/ }).click();
  await page.locator('.p-pick[data-kind="outfit"][data-id="o-1"]').click();
  await page.getByRole('tab', { name: /^Clothes/ }).click();
  await expect(page.locator('.p-pick[data-id="tee-1"]')).toContainText('In an outfit');
  await expect(page.getByRole('button', { name: 'Done · 3 on the list' })).toBeVisible();

  await page.locator('.p-pick[data-id="tee-1"]').click(); // makes it the trip's own
  await expect(page.locator('.p-pick[data-id="tee-1"]')).toContainText('On the list');
  const overflow = await page.locator('#p-sheet').evaluate((d) => d.scrollWidth - d.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: /^Done/ }).click();

  await page.getByRole('button', { name: 'Add items and outfits' }).click();
  await page.getByRole('tab', { name: /^Outfits/ }).click();
  await page.locator('.p-pick[data-kind="outfit"][data-id="o-1"]').click(); // take the outfit off again
  await page.getByRole('tab', { name: /^Clothes/ }).click();
  await expect(page.locator('.p-pick[data-id="tee-1"]')).toContainText('On the list'); // the tee stays
  await expect(page.locator('.p-pick[data-id="trousers-1"]')).toContainText('Add');
  await expect(page.getByRole('button', { name: 'Done · 1 on the list' })).toBeVisible();
});

test('an entry whose clothes were deleted shows as removed, can be taken off, and a trip can be deleted', async ({ page }) => {
  await page.goto('/#/packing');
  await seedStore(page, {
    trips: [{ v: 1, id: 't-1', name: 'Lisbon weekend', starts: '2026-12-14', ends: '2026-12-16', entries: [{ kind: 'item', ref: 'gone', packed: false }], savedAt: 1 }],
  });
  await page.reload();

  await page.getByRole('button', { name: /Lisbon weekend/ }).click();
  await expect(page.getByText('Clothes item removed from your wardrobe')).toBeVisible();
  await page.getByRole('button', { name: 'Take off' }).click();
  await expect(page.getByText('Nothing on the list yet')).toBeVisible();

  await page.getByRole('button', { name: 'Edit trip' }).click();
  await page.getByRole('button', { name: 'Delete trip' }).click();
  await page.getByRole('dialog', { name: /^Delete / }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('No trips yet. Tap New trip to start a packing list.')).toBeVisible();
});

test('will not save a trip that ends before it starts', async ({ page }) => {
  await page.goto('/#/packing');
  await page.getByRole('button', { name: 'New trip' }).click();
  await page.getByLabel('Starts').fill('2026-12-16');
  await page.getByLabel('Ends').fill('2026-12-14');
  await page.getByRole('button', { name: 'Save trip' }).click();
  await expect(page.getByText('The end date is before the start date.')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'New trip' })).toBeVisible();
});

test('Make me a template adds ticked-off-able lines, sends the palette only after the quiz, and keeps clothes on a re-run', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  let reply = { items: [{ label: 'Socks', quantity: 3, group: 'Clothes' }, { label: 'Passport', quantity: null, group: 'Documents' }, { label: 'Umbrella', quantity: null, group: null }] };
  await page.route('**/api/packing-template', (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ json: reply });
  });
  await page.goto('/#/packing');
  await seedStore(page, { wardrobe: [tee], trips: [{ ...lisbon, entries: [{ kind: 'item', ref: 'tee-1', packed: false, own: true }] }] });
  await page.reload();
  await page.getByRole('button', { name: /Lisbon weekend/ }).click();
  await expect(page.getByText(/Sends the trip name and dates to Gemini/)).toBeVisible();

  // No quiz yet: the name, the dates and the wardrobe list (id, garment, name, colour; V7-05) leave the phone, and nothing else.
  await page.getByRole('button', { name: 'Make me a template' }).click();
  await expect(page.locator('input[data-kind="template"]')).toHaveCount(3);
  expect(bodies[0]).toEqual({ name: 'Lisbon weekend', starts: '2026-12-14', ends: '2026-12-16', wardrobe: [{ id: 'tee-1', garment: 'tee', name: 'Navy tee', colour: '#1f2a5a' }] });
  await expect(page.locator('.p-count')).toHaveText('0 of 4 packed');
  await expect(page.getByText('3 × Socks')).toBeVisible();

  // Tick a line, edit one, remove one; the changes survive a reload.
  await page.locator('.p-row', { hasText: '3 × Socks' }).locator('input').check();
  await page.getByRole('button', { name: 'Edit Passport' }).click();
  await page.getByLabel('Text').fill('Passport and visa');
  await page.getByRole('button', { name: 'Save line' }).click();
  await page.getByRole('button', { name: 'Remove Umbrella' }).click();
  await expect(page.locator('.p-count')).toHaveText('1 of 3 packed');
  await page.reload();
  await page.getByRole('button', { name: /Lisbon weekend/ }).click();
  await expect(page.getByText('Passport and visa')).toBeVisible();
  await expect(page.getByText('Umbrella')).toHaveCount(0);
  await expect(page.locator('.p-row', { hasText: '3 × Socks' }).locator('input')).toBeChecked();

  // With the quiz done, the season and palette are sent. A re-run replaces the template lines and keeps the tee.
  await seedStore(page, { colourQuiz: FINISHED_QUIZ });
  reply = { items: [{ label: 'Linen shirt', quantity: null, group: 'Tops' }] };
  await page.getByRole('button', { name: 'Make me a template' }).click();
  await expect(page.getByText('Linen shirt')).toBeVisible();
  await expect(page.getByText('Passport and visa')).toHaveCount(0);
  await expect(page.locator('.p-tile[data-ref="tee-1"]')).toBeVisible();
  expect(Object.keys(bodies[1]).sort()).toEqual(['ends', 'name', 'season', 'starts', 'wardrobe']);
  const season = bodies[1].season as { name: string; palette: string[] };
  expect(season.name).toMatch(/Spring|Summer|Autumn|Winter/);
  expect(season.palette.length).toBeGreaterThan(0);
});

test('with no key or a Gemini error the screen says so plainly and the trip is unchanged', async ({ page }) => {
  await page.route('**/api/packing-template', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/#/packing');
  await seedStore(page, { trips: [{ ...lisbon, entries: [{ kind: 'template', ref: 'a', packed: false, text: 'Socks' }] }] });
  await page.reload();
  await page.getByRole('button', { name: /Lisbon weekend/ }).click();
  await page.getByRole('button', { name: 'Make me a template' }).click();
  await expect(page.locator('#p-tpl-status')).toHaveText('Packing templates are not switched on yet.');
  await expect(page.getByText('Socks')).toBeVisible();

  await page.unroute('**/api/packing-template');
  await page.route('**/api/packing-template', (route) => route.fulfill({ status: 502, body: 'Try again later' }));
  await page.getByRole('button', { name: 'Make me a template' }).click();
  await expect(page.locator('#p-tpl-status')).toHaveText('Could not make a template. Try again in a moment.');
  await expect(page.getByText('Socks')).toBeVisible();
  await expect(page.locator('input[data-kind="template"]')).toHaveCount(1);
});

test('snag list: the last trip is reopened, New trip sits above the trips, the page stays put, Packed is above To pack, and the add sheet closes with its X', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 700 });
  await page.goto('/#/packing');
  const entries = [
    { kind: 'item', ref: 'tee-1', packed: true, own: true },
    { kind: 'item', ref: 'trousers-1', packed: false, own: true },
  ];
  await seedStore(page, {
    wardrobe: [tee, trousers],
    trips: [
      { ...lisbon, entries },
      { ...lisbon, id: 't-2', name: 'Peak District', starts: '2027-01-02', ends: '2027-01-04', savedAt: 2, entries: [] },
    ],
  });
  await page.reload();

  // New trip is after the heading and before the first trip card.
  const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
  expect(await y('.page-title')).toBeLessThan(await y('#p-new'));
  expect(await y('#p-new')).toBeLessThan(await y('.p-trip'));

  // Choosing a trip does not scroll the page.
  await page.getByRole('button', { name: /Peak District/ }).click();
  await page.getByRole('button', { name: /Lisbon weekend/ }).click();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Packed comes before To pack.
  expect(await y('.p-packed-btn')).toBeLessThan(await y('h3.p-group'));

  // Leave for another tab and come back: the same trip is open.
  await page.evaluate(() => { location.hash = '#/wardrobe'; });
  await expect(page.locator('#p-detail')).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#/packing'; });
  await expect(page.locator('#p-title')).toHaveText('Lisbon weekend');
  await expect(page.getByRole('button', { name: /Lisbon weekend/ })).toHaveAttribute('aria-pressed', 'true');

  // The add sheet has a close button.
  await page.getByRole('button', { name: 'Add items and outfits' }).click();
  await expect(page.getByRole('dialog', { name: /Add to Lisbon weekend/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
