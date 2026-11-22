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

// V3.1-02: an inner garment worn under something is drawn as the pack's `_under_` file (its covered faces removed), and in full again when the outer comes off.
test('the pack\'s _under_ file is drawn while the outer garment is worn, and the full garment returns when it comes off', async ({ page }) => {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scenes: [{}], scene: 0 }));
  const pad = Buffer.alloc((4 - (json.length % 4)) % 4, 0x20);
  const jsonChunk = Buffer.concat([json, pad]);
  const head = Buffer.alloc(20);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + jsonChunk.length, 8);
  head.writeUInt32LE(jsonChunk.length, 12);
  head.write('JSON', 16, 'ascii');
  const glb = Buffer.concat([head, jsonChunk]);
  let asked = 0;
  await page.route('**/pack/*/tee_under_sweatshirt_over_tee.glb', (route) => {
    asked++;
    return route.fulfill({ contentType: 'model/gltf-binary', body: glb });
  });
  await page.route('**/pack/*/manifest.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ garments: { layers: { combinations: { sweatshirt: ['crew'] } }, inner_layers_drawn: { sweatshirt_over_tee: { tee: 'tee_under_sweatshirt_over_tee.glb' } } } }),
    }),
  );
  await signInAs(page, 'joe');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).not.toHaveText('Getting your avatar ready…');
  const stage = page.locator('.stage');
  await expect(stage).not.toHaveAttribute('data-under', /tee_under_sweatshirt_over_tee/);
  await openSlot(page, 'Top');
  await garment(page, 'Sweatshirt').click();
  await closeSlot(page);
  await openSlot(page, 'Under');
  await garment(page, 'T-shirt').click();
  await closeSlot(page);
  await expect(stage).toHaveAttribute('data-under', 'tee_under_sweatshirt_over_tee'); // the tee's covered faces are left out
  expect(asked).toBe(1);
  await openSlot(page, 'Top');
  await garment(page, 'Nothing').click();
  await closeSlot(page);
  await expect(stage).toHaveAttribute('data-under', ''); // the full tee again
});
