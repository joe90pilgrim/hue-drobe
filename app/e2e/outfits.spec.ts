import { expect, test, type Page } from '@playwright/test';
import { closeSlot, colourInput, garment, openSlot } from './helpers';

/**
 * Waits until the device's store holds this many saved outfits. The button's 'Outfit saved' text lasts only 1.5 seconds,
 * which is too short to wait for reliably, so the test reads the store instead.
 */
async function waitForOutfits(page: Page, count: number) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            try {
              const open = indexedDB.open('huedrobe', 1);
              open.onsuccess = () => {
                const get = open.result.transaction('kv').objectStore('kv').get('outfits');
                get.onsuccess = () => resolve(Array.isArray(get.result) ? get.result.length : 0);
                get.onerror = () => resolve(-1);
              };
              open.onerror = () => resolve(-1);
            } catch {
              resolve(-1);
            }
          }),
      ),
    )
    .toBe(count);
}

test('saves a look as an outfit, renames it, and wears it in one tap after a reload', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await colourInput(page).fill('#1f2a5a');
  await closeSlot(page);
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await waitForOutfits(page, 1);

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('button', { name: 'Wear outfit Navy tee, Light grey trousers' })).toBeVisible();
  await page.getByRole('button', { name: 'Rename outfit Navy tee, Light grey trousers' }).click();
  await page.getByLabel('Outfit name').fill('Work day');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Wear outfit Work day' })).toBeVisible();

  // Change the avatar, then wear the outfit back after a reload.
  await page.getByRole('link', { name: 'Try on' }).click();
  await openSlot(page, 'Top');
  await colourInput(page).fill('#aa5500');
  await garment(page, 'Sweatshirt').click();
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Wear outfit Work day' }).click();
  await expect(page).toHaveURL(/#\/try-on/);
  await expect(page.locator('[data-slot="Top"]')).toHaveText('T-shirt, crew neck');
  await expect(page.locator('[data-slot="Bottom"]')).toHaveText('Trousers');
  await openSlot(page, 'Top');
  await expect(colourInput(page)).toHaveValue('#1f2a5a');
});

test('an outfit whose item was deleted shows that slot as empty, and wearing it clears the slot', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await colourInput(page).fill('#1f2a5a');
  await closeSlot(page);
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await waitForOutfits(page, 1);

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: 'Delete Navy tee' }).click();
  await expect(page.getByText('Top: empty, Bottom: Light grey trousers')).toBeVisible();

  await page.getByRole('button', { name: 'Wear outfit Navy tee, Light grey trousers' }).click();
  await expect(page.locator('[data-slot="Top"]')).toHaveText('Nothing');
  await expect(page.locator('[data-slot="Bottom"]')).toHaveText('Trousers');
});

test('deletes a saved outfit and keeps the deletion after a reload', async ({ page }) => {
  await page.goto('/#/try-on');
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await waitForOutfits(page, 1);

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: 'Delete outfit Light grey tee, Light grey trousers' }).click();
  await expect(page.getByText('No outfits yet')).toBeVisible();
  await page.reload();
  await expect(page.getByText('No outfits yet')).toBeVisible();
});
