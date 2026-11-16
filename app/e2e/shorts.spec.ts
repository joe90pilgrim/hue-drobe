import { expect, test } from '@playwright/test';
import { addToWardrobe, closeSlot, colourInput, garment, inWardrobe, openSlot } from './helpers';

// V1.1-05: shorts are a Bottom option with their own colour, and can be saved and worn like the trousers.
test('offers shorts as a bottom with their own colour, and remembers the choice after a reload', async ({ page }) => {
  await page.goto('/#/try-on');
  const bottom = page.locator('[data-slot="Bottom"]');
  await expect(bottom).toHaveText('Trousers');
  await openSlot(page, 'Bottom');
  await expect(colourInput(page)).toBeEnabled();
  await colourInput(page).fill('#333333');

  await garment(page, 'Shorts').click();
  await expect(bottom).toHaveText('Shorts');
  await expect(colourInput(page)).toHaveValue('#d6d6d6'); // the trousers' colour stays with the trousers
  await colourInput(page).fill('#1f2a5a');
  // The colour is written to IndexedDB on change; go round the slot once so the write has landed before the reload.
  await garment(page, 'Trousers').click();
  await expect(colourInput(page)).toHaveValue('#333333');
  await garment(page, 'Shorts').click();
  await expect(colourInput(page)).toHaveValue('#1f2a5a');

  await page.reload();

  await expect(bottom).toHaveText('Shorts');
  await openSlot(page, 'Bottom');
  await expect(colourInput(page)).toHaveValue('#1f2a5a');

  await garment(page, 'Nothing').click();
  await expect(bottom).toHaveText('Nothing');
  await garment(page, 'Trousers').click();
  await expect(bottom).toHaveText('Trousers');
  await expect(colourInput(page)).toHaveValue('#333333');
});

test('adds shorts to the wardrobe and wears them from the library', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Bottom');
  await garment(page, 'Shorts').click();
  await colourInput(page).fill('#1f2a5a');
  await addToWardrobe(page).click();
  await expect(inWardrobe(page)).toBeVisible();

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('button', { name: 'Wear Navy shorts' })).toBeVisible();

  await page.getByRole('link', { name: 'Try on' }).click();

  await openSlot(page, 'Bottom');
  await garment(page, 'Trousers').click(); // back to trousers
  await closeSlot(page);
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: 'Wear Navy shorts' }).click();
  await expect(page).toHaveURL(/#\/try-on/);
  await expect(page.locator('[data-slot="Bottom"]')).toHaveText('Shorts');
  await openSlot(page, 'Bottom');
  await expect(colourInput(page)).toHaveValue('#1f2a5a');
});
