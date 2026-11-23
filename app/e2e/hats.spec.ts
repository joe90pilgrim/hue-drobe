import { expect, test, type Page } from '@playwright/test';
import { addToWardrobe, card, closeSlot, expectColour, garment, inWardrobe, openSlot, setColour, signInAs, tryItOn } from './helpers';

// V5-02: hats are a slot of their own, for both people: a cap and a beanie, in plain colour. While one is worn the hair is drawn as hair_under_<hat>
// (the faces the hat covers removed). The placeholder pack has no hats, so the tests that need them skip unless the machine has the private packs
// (npm run check:private).
test.use({ serviceWorkers: 'block' });

const hat = (page: Page) => page.locator('[data-slot="Hat"]');

async function hasHats(page: Page, person: 'joe' | 'b') {
  const res = await page.request.get(`/pack/${person}/cap.glb`);
  return res.ok() && res.headers()['content-type'] === 'model/gltf-binary';
}

test('a pack with no hats shows no Hat row', async ({ page }) => {
  test.skip(await hasHats(page, 'joe'), 'this pack has hats');
  await signInAs(page, 'joe');
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).not.toHaveText('Getting your avatar ready…');
  await expect(page.locator('[data-box="Hat"]')).toBeHidden();
});

for (const person of ['joe', 'b'] as const) {
  test(`${person} is offered a cap and a beanie, wears one over the hair, and a coloured one is saved and comes back`, async ({ page }) => {
    test.skip(!(await hasHats(page, person)), `needs ${person}'s private pack with hats (python pack/build_pack.py --private)`);
    await signInAs(page, person);
    await page.goto('/#/try-on');
    await expect(page.locator('.stage-status')).toBeHidden();
    await expect(hat(page)).toHaveText('Nothing');
    await expect(page.locator('#stage')).not.toHaveAttribute('data-under', /hair_under/); // no hat: the whole hair
    await openSlot(page, 'Hat');
    await expect(garment(page, 'Cap')).toBeVisible();
    await expect(garment(page, 'Beanie')).toBeVisible();
    await garment(page, 'Beanie').click();
    await expect(hat(page)).toHaveText('Beanie');
    await expect(page.locator('#stage')).toHaveAttribute('data-under', /hair_under_beanie/); // the hair as drawn under the beanie
    await setColour(page, '#2e5e8c');
    await addToWardrobe(page).click();
    await expect(inWardrobe(page)).toBeVisible();
    await garment(page, 'Cap').click();
    await expect(page.locator('#stage')).toHaveAttribute('data-under', /hair_under_cap/);
    await closeSlot(page);

    await page.reload();
    await expect(page.locator('.stage-status')).toBeHidden();
    await expect(hat(page)).toHaveText('Cap');
    await page.getByRole('link', { name: 'Wardrobe' }).click();
    await expect(card(page, 'Blue beanie')).toBeVisible();
    await tryItOn(page, 'Blue beanie');
    await expect(hat(page)).toHaveText('Beanie');
    await openSlot(page, 'Hat');
    await expectColour(page, '#2e5e8c');
    await garment(page, 'Nothing').click();
    await expect(hat(page)).toHaveText('Nothing');
    await expect(page.locator('#stage')).not.toHaveAttribute('data-under', /hair_under/); // the hat comes off, the whole hair comes back
    await closeSlot(page);
  });
}
