import { expect, test } from '@playwright/test';
import { addToWardrobe, closeSlot, setColour, expectColour, garment, inWardrobe, openSlot } from './helpers';

test('adds a tee to the wardrobe, renames it, wears it from the library, and keeps it after a reload', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await setColour(page, '#1f2a5a');
  await addToWardrobe(page).click();
  await expect(inWardrobe(page)).toBeVisible();
  await setColour(page, '#1f2a5b'); // a change means this is not the added one any more
  await expect(addToWardrobe(page)).toBeVisible();
  await setColour(page, '#1f2a5a');
  await expect(inWardrobe(page)).toBeVisible();

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('button', { name: 'Wear Navy tee' })).toBeVisible();

  await page.getByRole('button', { name: 'Rename Navy tee' }).click();
  await page.getByLabel('Name').fill('Work tee');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Wear Work tee' })).toBeVisible();

  // Change the avatar, then wear the saved item and check it comes back.
  await page.getByRole('link', { name: 'Try on' }).click();
  await openSlot(page, 'Top');
  await setColour(page, '#aa5500');
  await garment(page, 'Sweatshirt').click();
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Wear Work tee' }).click();
  await expect(page).toHaveURL(/#\/try-on/);
  await expect(page.locator('[data-slot="Top"]')).toHaveText('T-shirt, crew neck');
  await openSlot(page, 'Top');
  await expectColour(page, '#1f2a5a');
});

test('hides Add to wardrobe when nothing is worn, and deletes a saved item', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Bottom');
  await expect(addToWardrobe(page)).toBeVisible();
  await garment(page, 'Nothing').click();
  await expect(addToWardrobe(page)).toBeHidden();
  await garment(page, 'Trousers').click();
  await addToWardrobe(page).click(); // trousers, default colour
  await expect(inWardrobe(page)).toBeVisible();
  await closeSlot(page);
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: /^Delete / }).click();
  await expect(page.getByText('Nothing saved yet')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Nothing saved yet')).toBeVisible();
});
