import { expect, test } from '@playwright/test';

// V1.1-05: shorts are a Bottom option with their own colour, and can be saved and worn like the trousers.
test('offers shorts as a bottom with their own colour, and remembers the choice after a reload', async ({ page }) => {
  await page.goto('/#/dress');
  const bottom = page.locator('[data-slot="Bottom"]');
  await expect(bottom).toHaveText('Trousers');
  await expect(page.getByLabel('Bottom colour')).toBeEnabled();
  await page.getByLabel('Bottom colour').fill('#333333');

  await page.getByRole('button', { name: 'Next bottom' }).click();
  await expect(bottom).toHaveText('Shorts');
  await expect(page.getByLabel('Bottom colour')).toHaveValue('#d6d6d6'); // the trousers' colour stays with the trousers
  await page.getByLabel('Bottom colour').fill('#1f2a5a');
  // The colour is written to IndexedDB on change; go round the slot once so the write has landed before the reload.
  await page.getByRole('button', { name: 'Previous bottom' }).click();
  await expect(page.getByLabel('Bottom colour')).toHaveValue('#333333');
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await expect(page.getByLabel('Bottom colour')).toHaveValue('#1f2a5a');

  await page.reload();
  await expect(bottom).toHaveText('Shorts');
  await expect(page.getByLabel('Bottom colour')).toHaveValue('#1f2a5a');

  await page.getByRole('button', { name: 'Next bottom' }).click();
  await expect(bottom).toHaveText('None');
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await expect(bottom).toHaveText('Trousers');
  await expect(page.getByLabel('Bottom colour')).toHaveValue('#333333');
});

test('saves shorts and wears them from the library', async ({ page }) => {
  await page.goto('/#/dress');
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await page.getByLabel('Bottom colour').fill('#1f2a5a');
  await page.getByRole('button', { name: 'Save', exact: true }).last().click();

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('button', { name: 'Wear Navy shorts' })).toBeVisible();

  await page.getByRole('link', { name: 'Dress' }).click();
  await page.getByRole('button', { name: 'Previous bottom' }).click(); // back to trousers
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: 'Wear Navy shorts' }).click();
  await expect(page).toHaveURL(/#\/dress/);
  await expect(page.locator('[data-slot="Bottom"]')).toHaveText('Shorts');
  await expect(page.getByLabel('Bottom colour')).toHaveValue('#1f2a5a');
});
