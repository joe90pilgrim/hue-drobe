import { expect, test } from '@playwright/test';
import { seedStore, seedWardrobe } from './helpers';

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
  await page.locator('.p-pick[data-kind="outfit"][data-id="o-1"]').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await expect(page.locator('.p-count')).toHaveText('0 of 2 packed');
  // One square for the clothes item, in its colour; one per piece for the outfit (navy tee and light grey trousers).
  const rowOf = (ref: string) => page.locator('.p-row').filter({ has: page.locator(`input[data-ref="${ref}"]`) });
  await expect(rowOf('tee-1').locator('.p-swatch')).toHaveCount(1);
  await expect(rowOf('tee-1').locator('.p-swatch')).toHaveCSS('background-color', 'rgb(31, 42, 90)');
  await expect(rowOf('o-1').locator('.p-swatch')).toHaveCount(2);
  await page.locator('input[data-kind="item"][data-ref="tee-1"]').check();
  await page.locator('input[data-kind="outfit"][data-ref="o-1"]').check();
  await expect(page.locator('.p-count')).toHaveText('2 of 2 packed');

  await page.reload();
  await page.getByRole('button', { name: /Lisbon weekend/ }).click();
  await expect(page.locator('.p-count')).toHaveText('2 of 2 packed');
  await expect(page.locator('input[data-kind="item"][data-ref="tee-1"]')).toBeChecked();
  await expect(page.locator('input[data-kind="outfit"][data-ref="o-1"]')).toBeChecked();
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
