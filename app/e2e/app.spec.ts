import { expect, test } from '@playwright/test';
import { openRows } from './helpers';

test('opens on Try on and moves between the three screens', async ({ page }) => {
  await page.goto('/');
  await openRows(page);
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.locator('[data-slot="Top"]')).toHaveText('T-shirt, crew neck');

  await page.getByRole('link', { name: 'My colours' }).click();
  await expect(page).toHaveURL(/#\/colours$/);
  await expect(page.getByRole('heading', { name: 'My colours' })).toBeVisible();
  await expect(page.getByText('Find your season')).toBeVisible();

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page).toHaveURL(/#\/wardrobe$/);
  await expect(page.getByRole('heading', { name: 'Wardrobe', level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Try on' }).click();

  await openRows(page);
  await expect(page).toHaveURL(/#\/try-on$/);
  await expect(page.locator('#stage')).toBeVisible();
});

test('the name and logo show on every screen, and the tabs are Try on, Wardrobe and My colours', async ({ page }) => {
  for (const hash of ['try-on', 'wardrobe', 'colours']) {
    await page.goto(`/#/${hash}`);
    await expect(page.locator('.topbar .wordmark')).toHaveText('Hue-drobe');
    await expect(page.locator('.topbar .logo')).toBeVisible();
  }
  await expect(page.locator('.nav-item .nav-label')).toHaveText(['Try on', 'Wardrobe', 'My colours']);
});

test('old links #/dress and #/colour still open the right screen', async ({ page }) => {
  await page.goto('/#/dress');
  await expect(page.locator('#stage')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try on' })).toHaveAttribute('aria-current', 'page');
  await page.goto('/#/colour');
  await expect(page.getByRole('heading', { name: 'My colours' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My colours' })).toHaveAttribute('aria-current', 'page');
});

test('the phone tab bar is 56 px and the top bar is 52 px (no safe-area inset in the test browser)', async ({ page }) => {
  await page.goto('/');
  await openRows(page);
  expect(await page.locator('.nav').evaluate((el) => el.getBoundingClientRect().height)).toBe(56);
  expect(await page.locator('.topbar').evaluate((el) => el.getBoundingClientRect().height)).toBe(52);
});

test('on a laptop there is a 232 px sidebar, no top bar, and a main area wider than 960 px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/wardrobe');
  expect(await page.locator('.nav').evaluate((el) => el.getBoundingClientRect().width)).toBe(232);
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.side-brand .wordmark')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back up and restore' })).toBeVisible();
  expect(await page.locator('.main').evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(960);
});

test('switches outfit and remembers it after a reload', async ({ page }) => {
  await page.goto('/');
  await openRows(page);
  const top = page.locator('[data-slot="Top"]');
  const bottom = page.locator('[data-slot="Bottom"]');
  await expect(top).toHaveText('T-shirt, crew neck');
  await expect(bottom).toHaveText('Trousers');

  await page.getByRole('button', { name: 'Next top' }).click();
  await expect(top).toHaveText('Sweatshirt');
  await page.reload();
  await openRows(page);
  await expect(top).toHaveText('Sweatshirt');
  await page.getByRole('button', { name: 'Next top' }).click();
  await expect(top).toHaveText('Nothing');
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await expect(bottom).toHaveText('Shorts');
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await expect(bottom).toHaveText('Nothing');

  await page.reload();

  await openRows(page);
  await expect(top).toHaveText('Nothing');
  await expect(bottom).toHaveText('Nothing');

  await page.getByRole('button', { name: 'Previous top' }).click();
  await expect(top).toHaveText('Sweatshirt');
  await page.getByRole('button', { name: 'Previous top' }).click();
  await expect(top).toHaveText('T-shirt, crew neck');
});

test('sets the tee colour, keeps the trousers colour, and remembers it after a reload', async ({ page }) => {
  await page.goto('/');
  await openRows(page);
  const topColour = page.getByLabel('Top colour');
  const bottomColour = page.getByLabel('Bottom colour');
  await expect(topColour).toBeEnabled();
  await topColour.fill('#2e5e8c');
  await expect(topColour).toHaveValue('#2e5e8c');
  await expect(bottomColour).toHaveValue('#d6d6d6');

  await page.getByRole('button', { name: 'Next top' }).click(); // sweatshirt: its own colour, not the tee's
  await expect(topColour).toBeEnabled();
  await expect(topColour).toHaveValue('#d6d6d6');
  await page.getByRole('button', { name: 'Next top' }).click();
  await expect(topColour).toBeDisabled();
  await page.getByRole('button', { name: 'Previous top' }).click();
  await page.getByRole('button', { name: 'Previous top' }).click();
  await expect(topColour).toHaveValue('#2e5e8c');

  await page.reload();

  await openRows(page);
  await expect(page.getByLabel('Top colour')).toHaveValue('#2e5e8c');
  await expect(page.getByLabel('Bottom colour')).toHaveValue('#d6d6d6');
});
