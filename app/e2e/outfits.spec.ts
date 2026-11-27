import { expect, test, type Page } from '@playwright/test';
import { card, closeSlot, deleteCard, expectColour, garment, openCard, openSlot, setColour, tryItOn, wardrobeTab } from './helpers';

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
              const open = indexedDB.open('huedrobe-joe', 1);
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
  await setColour(page, '#1f2a5a');
  await closeSlot(page);
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await waitForOutfits(page, 1);

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(wardrobeTab(page, 'Outfits')).toHaveText('Outfits · 1');
  await wardrobeTab(page, 'Outfits').click();
  await expect(card(page, 'Navy tee, Light grey trousers')).toBeVisible();
  await openCard(page, 'Navy tee, Light grey trousers');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Name').fill('Work day');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Work day' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card(page, 'Work day')).toBeVisible();

  // Change the avatar, then wear the outfit back after a reload.
  await page.getByRole('link', { name: 'Try on' }).click();
  await openSlot(page, 'Top');
  await setColour(page, '#aa5500');
  await garment(page, 'Sweatshirt').click();
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.reload();
  await wardrobeTab(page, 'Outfits').click();
  await tryItOn(page, 'Work day');
  await expect(page.locator('[data-slot="Top"]')).toHaveText('T-shirt, crew neck');
  await expect(page.locator('[data-slot="Bottom"]')).toHaveText('Trousers');
  await openSlot(page, 'Top');
  await expectColour(page, '#1f2a5a');
});

test('an outfit whose item was deleted shows that slot as a gap, and wearing it clears the slot', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await setColour(page, '#1f2a5a');
  await closeSlot(page);
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await waitForOutfits(page, 1);

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await deleteCard(page, 'Navy tee');
  await wardrobeTab(page, 'Outfits').click();
  await expect(page.getByText('top deleted, Light grey trousers')).toBeVisible();
  await expect(page.locator('.w-card .o-gap[data-slot="top"]')).toHaveCount(1); // the gap is a dashed outline

  await tryItOn(page, 'Navy tee, Light grey trousers');
  await expect(page.locator('[data-slot="Top"]')).toHaveText('Nothing');
  await expect(page.locator('[data-slot="Bottom"]')).toHaveText('Trousers');
});

test('deletes a saved outfit after asking, and keeps the deletion after a reload', async ({ page }) => {
  await page.goto('/#/try-on');
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await waitForOutfits(page, 1);

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await wardrobeTab(page, 'Outfits').click();
  await deleteCard(page, 'Light grey tee, Light grey trousers');
  await expect(page.locator('#w-empty')).toBeVisible();
  await expect(page.locator('#w-empty')).toContainText('No outfits yet. On Try on, put a look together and');
  await page.reload();
  await wardrobeTab(page, 'Outfits').click();
  await expect(page.locator('#w-empty')).toBeVisible();
  await expect(page.locator('#w-empty')).toContainText('No outfits yet. On Try on, put a look together and');
});
