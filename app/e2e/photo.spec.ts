import { expect, test, type Page } from '@playwright/test';
import { card, openFineTune, wardrobeTab } from './helpers';

// A 1x1 PNG, standing in for a photo of a garment. No real photo is used.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const photo = { name: 'tee.png', mimeType: 'image/png', buffer: PNG };
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Add from photo' });

test('a photo is matched, shown in the pickers, changed, and saved without keeping the photo', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/identify', async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ json: { templateId: 'tee', variant: 'v', hexColor: '#1f2a5a', confidence: 0.9 } });
  });
  await page.goto('/#/wardrobe');
  await expect(page.locator('input[data-input="camera"]')).toHaveAttribute('capture', 'environment');
  await page.locator('input[data-input="upload"]').setInputFiles(photo);

  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText(/Looks like navy tee \(fairly sure\)/)).toBeVisible();
  // The suggestion fills the usual pickers.
  await expect(page.getByRole('radiogroup', { name: 'Garment' }).getByRole('radio', { name: 'Tee', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radiogroup', { name: 'Neckline' }).getByRole('radio', { name: 'V-neck' })).toHaveAttribute('aria-checked', 'true');
  await expect(sheet(page).locator('.cur-hex')).toHaveText('#1F2A5A');

  // Only the shrunk photo and the garment list leave the page: no name, no body data.
  expect(bodies).toHaveLength(1);
  expect(Object.keys(bodies[0]).sort()).toEqual(['image', 'mimeType', 'templates']);
  expect(bodies[0].mimeType).toBe('image/jpeg');
  expect((bodies[0].templates as { id: string }[]).map((t) => t.id)).toContain('shirt_mid');

  // Change the garment and the colour, then save.
  await page.getByRole('radiogroup', { name: 'Garment' }).getByRole('radio', { name: 'Sweatshirt' }).click();
  await expect(page.getByRole('radiogroup', { name: 'Neckline' })).toBeHidden();
  await openFineTune(page);
  await page.getByLabel('Colour code').fill('#aa5500');
  await expect(sheet(page).locator('.cur-hex')).toHaveText('#AA5500');
  await sheet(page).getByRole('button', { name: 'Add to wardrobe' }).click();

  await expect(sheet(page)).toBeHidden();
  await expect(wardrobeTab(page, 'Clothes')).toHaveText('Clothes · 1');
  await expect(page.getByRole('heading', { name: 'Brown sweatshirt' })).toBeVisible(); // the new item is opened
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(card(page, 'Brown sweatshirt')).toBeVisible();

  // The saved record holds the garment and colour only: no photo.
  const stored = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open('huedrobe-joe', 1);
        open.onsuccess = () => {
          const get = open.result.transaction('kv').objectStore('kv').get('wardrobe');
          get.onsuccess = () => resolve(get.result);
        };
      }),
  );
  expect(Object.keys((stored as Record<string, unknown>[])[0]).sort()).toEqual(['colour', 'garment', 'id', 'name', 'savedAt', 'v']);
});

test('when the photo cannot be matched, the same pickers open with defaults to fill in by hand', async ({ page }) => {
  await page.route('**/api/identify', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/#/wardrobe');
  await page.locator('input[data-input="camera"]').setInputFiles(photo);
  await expect(sheet(page).getByText(/not switched on yet/)).toBeVisible();
  await expect(sheet(page).locator('.cur-hex')).toHaveText('#8C8C8C');
  await sheet(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(wardrobeTab(page, 'Clothes')).toHaveText('Clothes · 0');
});
