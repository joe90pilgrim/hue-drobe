import { expect, test, type Page } from '@playwright/test';
import { closeSlot, expectColour, openSlot, setColour, signInAs } from './helpers';

// V5-04: hair is plain colour, one style each (Joe culturalibre_hair_02, B culturalibre_hair_01). The Hair row sets its colour, saved under `hair` in the `colours` map.
// The placeholder pack has no hair, so the colour test skips unless the machine has the private packs (npm run check:private).
test.use({ serviceWorkers: 'block' });

async function hasHair(page: Page, person: 'joe' | 'b') {
  const res = await page.request.get(`/pack/${person}/hair.glb`);
  return res.ok() && res.headers()['content-type'] === 'model/gltf-binary';
}

test('a pack with no hair shows no Hair row', async ({ page }) => {
  test.skip(await hasHair(page, 'joe'), 'this pack has hair');
  await signInAs(page, 'joe');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).not.toHaveText('Getting your avatar ready…');
  await expect(page.locator('[data-box="Hair"]')).toBeHidden();
});

for (const person of ['joe', 'b'] as const) {
  test(`${person}'s hair starts dark brown, a new colour is saved and comes back, and it is not part of a saved outfit`, async ({ page }) => {
    test.skip(!(await hasHair(page, person)), `needs ${person}'s private pack with hair (python pack/build_pack.py --private)`);
    await signInAs(page, person);
    await page.goto('/#/try-on');
    await expect(page.locator('.stage-status')).toBeHidden();
    await expect(page.locator('[data-box="Hair"]')).toBeVisible();
    await openSlot(page, 'Hair');
    await expectColour(page, '#3b2a1f');
    await expect(page.locator('.add-wardrobe')).toBeHidden(); // hair is not a wardrobe item
    await setColour(page, '#8a5a2b');
    await closeSlot(page);

    await page.reload();
    await expect(page.locator('.stage-status')).toBeHidden();
    await openSlot(page, 'Hair');
    await expectColour(page, '#8a5a2b');
    await closeSlot(page);
    await expect(page.locator('#save-outfit')).toBeEnabled(); // the default outfit has a tee and trousers; hair alone would not enable it
  });
}
