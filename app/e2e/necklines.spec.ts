import { expect, test } from '@playwright/test';
import { addToWardrobe, card, tryItOn, wardrobeTab, closeSlot, setColour, expectColour, garment, inWardrobe, neckline, necklines, openSlot } from './helpers';

test('offers the necklines on the tee only, defaults to crew, and remembers the choice after a reload', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await expect(necklines(page)).toBeVisible();
  await expect(neckline(page, 'Crew')).toHaveAttribute('aria-checked', 'true');

  await neckline(page, 'V-neck').click();
  await expect(neckline(page, 'V-neck')).toHaveAttribute('aria-checked', 'true');
  await expect(neckline(page, 'Crew')).toHaveAttribute('aria-checked', 'false');

  await page.reload();

  await openSlot(page, 'Top');
  await expect(neckline(page, 'V-neck')).toHaveAttribute('aria-checked', 'true');

  await neckline(page, 'Scoop').click();
  await expect(neckline(page, 'Scoop')).toHaveAttribute('aria-checked', 'true');

  // The sweatshirt and "Nothing" have no necklines to choose; coming back to the tee keeps the choice.
  await garment(page, 'Sweatshirt').click();
  await expect(necklines(page)).toBeHidden();
  await garment(page, 'Nothing').click();
  await expect(necklines(page)).toBeHidden();
  await garment(page, 'T-shirt').click();
  await expect(necklines(page)).toBeVisible();
  await expect(neckline(page, 'Scoop')).toHaveAttribute('aria-checked', 'true');
});

test('keeps the colour when the neckline changes', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await setColour(page, '#2e5e8c');
  await neckline(page, 'V-neck').click();
  await expectColour(page, '#2e5e8c');
  await neckline(page, 'Scoop').click();
  await expectColour(page, '#2e5e8c');
});

test('adds a V-neck tee next to a crew-neck tee of the same colour, and wears each with its neckline', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await setColour(page, '#1f2a5a');
  await addToWardrobe(page).click(); // crew
  await expect(inWardrobe(page)).toBeVisible();

  await neckline(page, 'V-neck').click();
  await expect(addToWardrobe(page)).toBeVisible(); // a different neckline is a different item
  await addToWardrobe(page).click(); // V-neck
  await expect(inWardrobe(page)).toBeVisible();

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(card(page, 'Navy tee')).toBeVisible();
  await expect(card(page, 'Navy V-neck tee')).toBeVisible();
  await expect(page.getByText('T-shirt, crew neck')).toBeVisible();
  await expect(page.getByText('T-shirt, V-neck')).toBeVisible();

  // Wear the crew tee, then the V-neck one, after a reload.
  await page.reload();
  await tryItOn(page, 'Navy tee');
  await openSlot(page, 'Top');
  await expect(neckline(page, 'Crew')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await tryItOn(page, 'Navy V-neck tee');
  await openSlot(page, 'Top');
  await expect(neckline(page, 'V-neck')).toHaveAttribute('aria-checked', 'true');
});

test('an outfit remembers the tee neckline it was saved with', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await neckline(page, 'Scoop').click();
  await closeSlot(page);
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await expect(page.getByRole('button', { name: 'Outfit saved' })).toBeVisible();

  await openSlot(page, 'Top');
  await neckline(page, 'Crew').click();
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await wardrobeTab(page, 'Outfits').click();
  await tryItOn(page, 'Light grey scoop-neck tee, Light grey trousers');
  await openSlot(page, 'Top');
  await expect(neckline(page, 'Scoop')).toHaveAttribute('aria-checked', 'true');
});
