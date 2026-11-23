import { expect, test, type Page } from '@playwright/test';
import { addToWardrobe, card, closeSlot, expectColour, garment, inWardrobe, openSlot, setColour, signInAs, tryItOn } from './helpers';

// V5-01: shoes are a slot of their own. Each person's pack has only the shoes built for them: Joe trainers, Oxfords and sandals; B those and ankle boots.
// The placeholder pack has no shoes, so the tests that need them skip unless the machine has the private packs (npm run check:private).
test.use({ serviceWorkers: 'block' });

const shoes = (page: Page) => page.locator('[data-slot="Shoes"]');

async function hasShoes(page: Page, person: 'joe' | 'b') {
  const res = await page.request.get(`/pack/${person}/trainers.glb`);
  return res.ok() && res.headers()['content-type'] === 'model/gltf-binary';
}

test('a pack with no shoes shows no Shoes row', async ({ page }) => {
  test.skip(await hasShoes(page, 'joe'), 'this pack has shoes');
  await signInAs(page, 'joe');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).not.toHaveText('Getting your avatar ready…');
  await expect(page.locator('[data-box="Shoes"]')).toBeHidden();
});

test("Joe is offered trainers, Oxfords and sandals, never ankle boots, and a tinted pair is saved and comes back", async ({ page }) => {
  test.skip(!(await hasShoes(page, 'joe')), "needs Joe's private pack with shoes (python pack/build_pack.py --private)");
  await signInAs(page, 'joe');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).toBeHidden();
  await expect(shoes(page)).toHaveText('Nothing');
  await openSlot(page, 'Shoes');
  await expect(garment(page, 'Trainers')).toBeVisible();
  await expect(garment(page, 'Oxfords')).toBeVisible();
  await expect(garment(page, 'Sandals')).toBeVisible();
  await expect(garment(page, 'Ankle boots')).toHaveCount(0);
  await garment(page, 'Oxfords').click();
  await expect(shoes(page)).toHaveText('Oxfords');
  await expectColour(page, '#ffffff'); // as made
  await setColour(page, '#6b3f26');
  await addToWardrobe(page).click();
  await expect(inWardrobe(page)).toBeVisible();
  await closeSlot(page);

  await page.reload();
  await expect(shoes(page)).toHaveText('Oxfords');
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(card(page, 'Brown Oxfords')).toBeVisible();
  await tryItOn(page, 'Brown Oxfords');
  await expect(shoes(page)).toHaveText('Oxfords');
});

test("B is offered ankle boots as well, and wears them with the dress without the avatar failing to draw", async ({ page }) => {
  test.skip(!(await hasShoes(page, 'b')), "needs B's private pack with shoes (python pack/build_pack.py --private)");
  await signInAs(page, 'b');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).toBeHidden();
  await openSlot(page, 'Shoes');
  for (const s of ['Trainers', 'Oxfords', 'Sandals', 'Ankle boots']) await expect(garment(page, s)).toBeVisible();
  await garment(page, 'Ankle boots').click();
  await expect(shoes(page)).toHaveText('Ankle boots');
  await closeSlot(page);
  await expect(page.locator('.stage-status')).toBeHidden();
});
