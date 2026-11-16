import { expect, test } from '@playwright/test';
import { addToWardrobe, card, closeSlot, expectColour, garment, inWardrobe, openSlot, setColour, tryItOn } from './helpers';

// V2-04: tights have their own Legs row, a colour, and opaque or sheer. They go under shorts, never under trousers.
const legs = (page: import('@playwright/test').Page) => page.locator('[data-slot="Legs"]');
const sheerness = (page: import('@playwright/test').Page, name: 'Opaque' | 'Sheer') =>
  page.getByRole('radiogroup', { name: 'Sheerness' }).getByRole('radio', { name, exact: true });

test('tights are greyed out under trousers, and putting trousers on takes them off', async ({ page }) => {
  await page.goto('/#/try-on');
  await expect(legs(page)).toHaveText('Nothing');
  await openSlot(page, 'Legs');
  await expect(garment(page, 'Tights')).toBeDisabled(); // the default bottom is trousers
  await expect(page.getByText('Tights go under shorts, not trousers.')).toBeVisible();
  await closeSlot(page);

  await openSlot(page, 'Bottom');
  await garment(page, 'Shorts').click();
  await closeSlot(page);
  await openSlot(page, 'Legs');
  await expect(page.getByText('Tights go under shorts, not trousers.')).toBeHidden();
  await garment(page, 'Tights').click();
  await expect(legs(page)).toHaveText('Tights, opaque');
  await closeSlot(page);

  await openSlot(page, 'Bottom');
  await garment(page, 'Trousers').click();
  await expect(legs(page)).toHaveText('Nothing');
});

test('tights take a colour and a sheerness, are remembered, and can be saved and worn', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Bottom');
  await garment(page, 'Shorts').click();
  await closeSlot(page);
  await openSlot(page, 'Legs');
  await expect(page.getByRole('radiogroup', { name: 'Sheerness' })).toBeHidden(); // nothing worn yet
  await garment(page, 'Tights').click();
  await expect(sheerness(page, 'Opaque')).toHaveAttribute('aria-checked', 'true');
  await setColour(page, '#111111');
  await sheerness(page, 'Sheer').click();
  await expect(legs(page)).toHaveText('Tights, sheer');
  await addToWardrobe(page).click();
  await expect(inWardrobe(page)).toBeVisible();

  await page.reload();
  await expect(legs(page)).toHaveText('Tights, sheer');
  await openSlot(page, 'Legs');
  await expectColour(page, '#111111');
  await sheerness(page, 'Opaque').click();
  await expect(addToWardrobe(page)).toBeVisible(); // opaque black is a different item from sheer black
  await garment(page, 'Nothing').click();
  await closeSlot(page);

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(card(page, 'Black sheer tights')).toBeVisible();
  await expect(card(page, 'Black sheer tights').locator('.w-sub')).toHaveText('Tights, sheer');
  await tryItOn(page, 'Black sheer tights');
  await expect(legs(page)).toHaveText('Tights, sheer');
});
