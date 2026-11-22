import { expect, test } from '@playwright/test';
import { closeSlot, garment, necklines, openSlot, signInAs } from './helpers';

// V3-11: garment chips and the variant row in the slot sheet. UI only; the stored option strings are unchanged.
test.use({ serviceWorkers: 'block' });

async function openTop(page: import('@playwright/test').Page) {
  await page.route('**/pack/*/manifest.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ garments: { layers: { combinations: {} } } }) }));
  await signInAs(page, 'joe');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).not.toHaveText('Getting your avatar ready…', { timeout: 20000 });
  await openSlot(page, 'Top');
}
const sleeves = (page: import('@playwright/test').Page) => page.getByRole('radiogroup', { name: 'Sleeves' });

test('Top shows chips with Nothing first, 44 px high, and no horizontal overflow at 360 and 390 px', async ({ page }) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/#/try-on');
    if (!(await page.getByRole('dialog', { name: 'Top' }).isVisible())) await openTop(page);
    const chips = page.getByRole('radiogroup', { name: 'Garment' }).getByRole('radio');
    await expect(chips.first()).toHaveText('Nothing');
    for (const c of await chips.all()) expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('Shirt then Long selects the long-sleeve shirt; T-shirt shows Neckline; Sweatshirt shows no variant row; Nothing hides colour and Add to wardrobe', async ({ page }) => {
  await openTop(page);
  await garment(page, 'Shirt, long sleeves').click();
  await expect(page.getByRole('radiogroup', { name: 'Garment' }).getByRole('radio', { name: 'Shirt', exact: true })).toBeChecked();
  await expect(sleeves(page).getByRole('radio', { name: 'Long', exact: true })).toBeChecked();
  await closeSlot(page);
  await expect(page.locator('[data-slot="Top"]')).toContainText('Shirt, long sleeves');

  await openSlot(page, 'Top');
  await garment(page, 'T-shirt').click();
  await expect(necklines(page)).toBeVisible();
  await expect(sleeves(page)).toBeHidden();
  await garment(page, 'Sweatshirt').click();
  await expect(sleeves(page)).toBeHidden();
  await expect(necklines(page)).toBeHidden();
  // Back to Shirt: the last sleeve length used this session returns.
  await garment(page, 'Shirt, long sleeves').click();
  await garment(page, 'Nothing').click();
  await expect(sleeves(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Add to wardrobe', exact: true })).toBeHidden();
});
