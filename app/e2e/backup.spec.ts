import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

// V1.1-06: export, clear the app's storage, import, and everything comes back.
test('backs up and restores saved clothes and outfits', async ({ page }, info) => {
  await page.goto('/#/try-on');
  await page.getByLabel('Top colour').fill('#1f2a5a');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const open = indexedDB.open('huedrobe', 1);
            open.onsuccess = () => {
              const get = open.result.transaction('kv').objectStore('kv').get('outfits');
              get.onsuccess = () => resolve(Array.isArray(get.result) ? get.result.length : 0);
              get.onerror = () => resolve(-1);
            };
            open.onerror = () => resolve(-1);
          }),
      ),
    )
    .toBe(1);
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('button', { name: 'Wear Navy tee' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Wear outfit/ })).toBeVisible();

  await expect(page.getByText('Back up', { exact: true })).toHaveCount(0); // no backup card in the Wardrobe
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Back up and restore' })).toBeVisible();
  await expect(page.getByText('Restoring from a file replaces everything on this device.')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a backup' }).click()]);
  await page.getByRole('button', { name: 'Close' }).click();
  const path = info.outputPath('backup.json');
  await download.saveAs(path);

  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        const r = indexedDB.deleteDatabase('huedrobe');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      }),
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Wear Navy tee' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.locator('#b-file').setInputFiles(path);
  await expect(page.getByText('Replace everything on this device with this backup?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Wear Navy tee' })).toHaveCount(0);
  await page.locator('#b-file').setInputFiles(path);
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByText('Backup restored.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Wear Navy tee' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Wear outfit/ })).toBeVisible();

  const bad = info.outputPath('bad.json');
  writeFileSync(bad, '{"hello":1}');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.locator('#b-file').setInputFiles(bad);
  await expect(page.getByText('not a Hue-drobe backup')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Wear Navy tee' })).toBeVisible();
});
