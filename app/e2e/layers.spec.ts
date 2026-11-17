import { expect, test, type Page } from '@playwright/test';
import { closeSlot, garment, neckline, openSlot, signInAs } from './helpers';

// V3-05: a tee under a sweatshirt or shirt, offered only for the combinations the pack's manifest lists as passed on this body.
// The manifest is stubbed, so this needs no private pack; the viewer only reads it for the list.
test.use({ serviceWorkers: 'block' });

const under = (page: Page) => page.locator('[data-slot="Under"]');
const top = (page: Page) => page.locator('[data-slot="Top"]');

async function openTryOn(page: Page, combinations: Record<string, string[]>) {
  await page.route('**/pack/*/manifest.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ garments: { layers: { combinations } } }) }),
  );
  await signInAs(page, 'joe');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).not.toHaveText('Getting your avatar ready…'); // the pack has loaded or failed
}

test('a body whose pack lists no passing combination is not offered a tee under', async ({ page }) => {
  await openTryOn(page, {});
  await openSlot(page, 'Top');
  await garment(page, 'Sweatshirt').click();
  await closeSlot(page);
  await expect(page.locator('[data-row="Under"]')).toBeHidden();
});

test('a passing combination can be worn: a tee under the sweatshirt, only over the necklines that passed', async ({ page }) => {
  await openTryOn(page, { sweatshirt: ['crew', 'v'] });
  await openSlot(page, 'Top');
  await garment(page, 'Sweatshirt').click();
  await closeSlot(page);
  await expect(top(page)).toHaveText('Sweatshirt');
  await openSlot(page, 'Under');
  await garment(page, 'T-shirt').click();
  await expect(under(page)).toHaveText('T-shirt, crew neck');
  await expect(neckline(page, 'Scoop')).toBeDisabled();
  await neckline(page, 'V-neck').click();
  await expect(under(page)).toHaveText('T-shirt, V-neck');
  await closeSlot(page);

  await page.reload(); // the choice is remembered
  await expect(under(page)).toHaveText('T-shirt, V-neck');

  await openSlot(page, 'Top'); // a plain tee on top takes the tee under off
  await garment(page, 'T-shirt').click();
  await closeSlot(page);
  await expect(under(page)).toHaveText('Nothing');
});

test('a top with no passing combination is not offered a tee under it', async ({ page }) => {
  await openTryOn(page, { sweatshirt: ['crew'] });
  await openSlot(page, 'Top');
  await garment(page, 'Sweatshirt').click();
  await closeSlot(page);
  await openSlot(page, 'Top');
  await garment(page, 'Shirt, short sleeves').click();
  await closeSlot(page);
  await expect(page.locator('[data-row="Under"]')).toBeHidden();
});
