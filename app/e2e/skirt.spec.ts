import { expect, test, type Page } from '@playwright/test';
import { addToWardrobe, card, closeSlot, expectColour, garment, inWardrobe, openSlot, setColour, signInAs, tryItOn } from './helpers';

// V3-01b: the skirt is a bottom in a woman's pack only. A top is tucked into it, and a sweatshirt never goes with it.
// The pack is private, so the tests that need B's pack skip when the machine has none.
test.use({ serviceWorkers: 'block' });

const bottom = (page: Page) => page.locator('[data-slot="Bottom"]');
const top = (page: Page) => page.locator('[data-slot="Top"]');
const legs = (page: Page) => page.locator('[data-slot="Legs"]');

async function hasWomansPack(page: Page) {
  const res = await page.request.get('/pack/b/skirt.glb');
  return res.ok() && res.headers()['content-type'] === 'model/gltf-binary';
}

test('a pack without a skirt does not offer one', async ({ page }) => {
  await signInAs(page, 'joe');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).not.toHaveText('Getting your avatar ready…'); // the pack has loaded or failed
  await openSlot(page, 'Bottom');
  await expect(garment(page, 'Trousers')).toBeVisible();
  await expect(garment(page, 'Skirt')).toHaveCount(0);
});

test('with a skirt in the pack it is offered as a bottom, with a colour, and can be saved and worn', async ({ page }) => {
  test.skip(!(await hasWomansPack(page)), "needs B's private pack with a skirt (python pack/build_pack.py --private)");
  await signInAs(page, 'b');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).toBeHidden(); // the pack has loaded
  await openSlot(page, 'Bottom');
  await garment(page, 'Skirt').click();
  await expect(bottom(page)).toHaveText('Skirt');
  await setColour(page, '#1f2a5a');
  await addToWardrobe(page).click();
  await expect(inWardrobe(page)).toBeVisible();
  await closeSlot(page);

  await page.reload();
  await expect(bottom(page)).toHaveText('Skirt');
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(card(page, 'Navy skirt')).toBeVisible();
  await expect(card(page, 'Navy skirt').locator('.w-sub')).toHaveText('Skirt');
  await tryItOn(page, 'Navy skirt');
  await expect(bottom(page)).toHaveText('Skirt');
  await openSlot(page, 'Bottom');
  await expectColour(page, '#1f2a5a');
});

test('a sweatshirt and a skirt are never worn together, and tights go with the skirt', async ({ page }) => {
  test.skip(!(await hasWomansPack(page)), "needs B's private pack with a skirt (python pack/build_pack.py --private)");
  await signInAs(page, 'b');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).toBeHidden(); // the pack has loaded
  await openSlot(page, 'Bottom');
  await garment(page, 'Skirt').click();
  await closeSlot(page);

  await openSlot(page, 'Top');
  await expect(garment(page, 'Sweatshirt')).toBeDisabled();
  await expect(page.getByText("A sweatshirt isn't tucked in")).toBeVisible();
  await expect(garment(page, 'T-shirt')).toBeEnabled();
  await closeSlot(page);

  await openSlot(page, 'Legs');
  await expect(garment(page, 'Tights')).toBeEnabled(); // tights go under a skirt
  await garment(page, 'Tights').click();
  await expect(legs(page)).toHaveText('Tights, opaque');
  await closeSlot(page);

  await openSlot(page, 'Bottom');
  await garment(page, 'Trousers').click(); // takes the tights off
  await closeSlot(page);
  await openSlot(page, 'Top');
  await garment(page, 'Sweatshirt').click();
  await expect(top(page)).toHaveText('Sweatshirt');
  await closeSlot(page);
  await openSlot(page, 'Bottom');
  await expect(garment(page, 'Skirt')).toBeDisabled();
  await expect(page.getByText('A skirt goes with a T-shirt or nothing on top.')).toBeVisible();
});
