import { expect, test } from '@playwright/test';
import { chooseButton, chooserBack, closeSlot, expectColour, favourite, openSlot } from './helpers';

const chooser = (page: import('@playwright/test').Page) => page.locator('.chooser');
const slider = (page: import('@playwright/test').Page, name: string) => chooser(page).getByRole('slider', { name });

test('no colour input is left in the app', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await chooseButton(page).click();
  await expect(page.locator('input[type="color"]')).toHaveCount(0);
});

test('opens inside the panel, keeps the avatar in view, and goes back to the controls', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await chooseButton(page).click();
  await expect(chooser(page)).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Garment' })).toBeHidden();
  const stage = await page.locator('#stage').boundingBox();
  expect(stage!.height).toBeGreaterThanOrEqual(120);
  for (const name of ['Colour', 'Strength', 'Lightness']) await expect(slider(page, name)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Basic colours' }).getByRole('button')).toHaveCount(6);
  await chooserBack(page).click();
  await expect(chooser(page)).toBeHidden();
  await expect(page.getByRole('radiogroup', { name: 'Garment' })).toBeVisible();
  await expect(chooseButton(page)).toBeFocused();
});

test('a typed code, a Basics tile and a slider all give the exact hex on the swatch, and it is saved', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await chooseButton(page).click();
  await page.getByLabel('Colour code').fill('1E2959');
  await expect(page.getByRole('img', { name: 'Chosen colour #1e2959' })).toBeVisible();
  await page.getByRole('group', { name: 'Basic colours' }).getByRole('button', { name: 'Cream' }).click();
  await expect(page.getByRole('img', { name: 'Chosen colour #f2ede3' })).toBeVisible();
  await expect(page.getByLabel('Colour code')).toHaveValue('#F2EDE3');
  await slider(page, 'Strength').fill('100');
  const chosen = await page.getByRole('img', { name: /^Chosen colour #/ }).getAttribute('aria-label');
  const hex = chosen!.replace('Chosen colour ', '');
  expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  expect(hex).not.toBe('#f2ede3');
  await chooserBack(page).click();
  await expectColour(page, hex);
  await page.reload();
  await openSlot(page, 'Top');
  await expectColour(page, hex);
});

test('the sliders work with the keyboard and the Favourite toggle works inside the chooser', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await chooseButton(page).click();
  await page.getByLabel('Colour code').fill('#808080');
  const strength = slider(page, 'Strength');
  await strength.focus();
  await page.keyboard.press('ArrowRight');
  await expect(strength).toHaveValue('1');
  await expect(page.getByLabel('Colour code')).not.toHaveValue('#808080');
  await chooser(page).getByRole('button', { name: 'Favourite', exact: true }).click();
  await expect(chooser(page).getByRole('button', { name: 'Favourite', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await chooserBack(page).click();
  await expect(favourite(page)).toHaveAttribute('aria-pressed', 'true');
});

test('Escape goes back to the controls first, then closes the panel; Done closes it from the chooser', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await chooseButton(page).click();
  await page.keyboard.press('Escape');
  await expect(chooser(page)).toBeHidden();
  await expect(page.getByRole('dialog')).toBeVisible();
  await chooseButton(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await openSlot(page, 'Top');
  await expect(chooser(page)).toBeHidden(); // reopens on the controls
  await closeSlot(page);
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('nothing is cut off at 390 px and the avatar stays in view while a slider moves', async ({ page }) => {
    await page.goto('/#/try-on');
    await openSlot(page, 'Top');
    await chooseButton(page).click();
    const overflow = await page.evaluate(() => {
      const c = document.querySelector('.chooser')!;
      return { scroll: c.scrollWidth, client: c.clientWidth, page: document.documentElement.scrollWidth };
    });
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
    expect(overflow.page).toBeLessThanOrEqual(390);
    const stageBefore = await page.locator('#stage').boundingBox();
    expect(stageBefore!.height).toBeGreaterThanOrEqual(120);
    await slider(page, 'Colour').fill('200');
    const stageAfter = await page.locator('#stage').boundingBox();
    expect(stageAfter!.height).toBe(stageBefore!.height);
    for (const tile of await page.getByRole('group', { name: 'Basic colours' }).getByRole('button').all()) {
      const box = (await tile.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
