import { expect, test } from '@playwright/test';

test('saves a tee, renames it, wears it from the library, and keeps it after a reload', async ({ page }) => {
  await page.goto('/#/dress');
  await page.getByLabel('Top colour').fill('#1f2a5a');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('button', { name: 'Wear Navy tee' })).toBeVisible();

  await page.getByRole('button', { name: 'Rename Navy tee' }).click();
  await page.getByLabel('Name').fill('Work tee');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Wear Work tee' })).toBeVisible();

  // Change the avatar, then wear the saved item and check it comes back.
  await page.getByRole('link', { name: 'Dress' }).click();
  await page.getByLabel('Top colour').fill('#aa5500');
  await page.getByRole('button', { name: 'Next top' }).click(); // sweatshirt
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Wear Work tee' }).click();
  await expect(page).toHaveURL(/#\/dress/);
  await expect(page.getByLabel('Top colour')).toHaveValue('#1f2a5a');
  await expect(page.locator('[data-slot="Top"]')).toHaveText('T-shirt');
});

test('deletes a saved item', async ({ page }) => {
  await page.goto('/#/dress');
  await page.getByRole('button', { name: 'Save', exact: true }).last().click(); // trousers, default colour
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: /^Delete / }).click();
  await expect(page.getByText('Nothing saved yet')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Nothing saved yet')).toBeVisible();
});
