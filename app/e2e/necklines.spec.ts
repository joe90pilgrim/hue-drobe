import { expect, test } from '@playwright/test';

const necks = (page: import('@playwright/test').Page) => page.getByRole('group', { name: 'Neckline' });
const pressed = (page: import('@playwright/test').Page, name: string) =>
  necks(page).getByRole('button', { name, exact: true });

test('offers the necklines on the tee only, defaults to crew, and remembers the choice after a reload', async ({ page }) => {
  await page.goto('/#/dress');
  await expect(necks(page)).toBeVisible();
  await expect(pressed(page, 'Crew')).toHaveAttribute('aria-pressed', 'true');

  await pressed(page, 'V-neck').click();
  await expect(pressed(page, 'V-neck')).toHaveAttribute('aria-pressed', 'true');
  await expect(pressed(page, 'Crew')).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await expect(pressed(page, 'V-neck')).toHaveAttribute('aria-pressed', 'true');

  await pressed(page, 'Scoop').click();
  await expect(pressed(page, 'Scoop')).toHaveAttribute('aria-pressed', 'true');

  // The sweatshirt and "None" have no necklines to choose; coming back to the tee keeps the choice.
  await page.getByRole('button', { name: 'Next top' }).click();
  await expect(necks(page)).toBeHidden();
  await page.getByRole('button', { name: 'Next top' }).click();
  await expect(necks(page)).toBeHidden();
  await page.getByRole('button', { name: 'Next top' }).click();
  await expect(necks(page)).toBeVisible();
  await expect(pressed(page, 'Scoop')).toHaveAttribute('aria-pressed', 'true');
});

test('keeps the colour when the neckline changes', async ({ page }) => {
  await page.goto('/#/dress');
  await page.getByLabel('Top colour').fill('#2e5e8c');
  await pressed(page, 'V-neck').click();
  await expect(page.getByLabel('Top colour')).toHaveValue('#2e5e8c');
  await pressed(page, 'Scoop').click();
  await expect(page.getByLabel('Top colour')).toHaveValue('#2e5e8c');
});

test('saves a V-neck tee next to a crew-neck tee of the same colour, and wears each with its neckline', async ({ page }) => {
  await page.goto('/#/dress');
  await page.getByLabel('Top colour').fill('#1f2a5a');
  const save = page.locator('[data-save="Top"]');
  await save.click(); // crew
  await expect(save).toHaveText('Saved');
  await expect(save).toHaveText('Save'); // the label returns after 1.5 s

  await pressed(page, 'V-neck').click();
  await save.click(); // V-neck
  await expect(save).toHaveText('Saved');

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('button', { name: 'Wear Navy tee' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wear Navy V-neck tee' })).toBeVisible();
  await expect(page.getByText('T-shirt, crew neck')).toBeVisible();
  await expect(page.getByText('T-shirt, V-neck')).toBeVisible();

  // Wear the crew tee, then the V-neck one, after a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Wear Navy tee' }).click();
  await expect(pressed(page, 'Crew')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: 'Wear Navy V-neck tee' }).click();
  await expect(pressed(page, 'V-neck')).toHaveAttribute('aria-pressed', 'true');
});

test('an outfit remembers the tee neckline it was saved with', async ({ page }) => {
  await page.goto('/#/dress');
  await pressed(page, 'Scoop').click();
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await expect(page.getByRole('button', { name: 'Outfit saved' })).toBeVisible();

  await pressed(page, 'Crew').click();
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.getByRole('button', { name: /^Wear outfit Light grey scoop-neck tee/ }).click();
  await expect(pressed(page, 'Scoop')).toHaveAttribute('aria-pressed', 'true');
});
