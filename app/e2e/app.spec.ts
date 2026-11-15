import { expect, test } from '@playwright/test';

test('opens on Dress and moves between the two screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dress' })).toBeVisible();
  await expect(page.locator('[data-slot="Top"]')).toHaveText('T-shirt');

  await page.getByRole('link', { name: 'Colour' }).click();
  await expect(page.getByRole('heading', { name: 'Colour' })).toBeVisible();
  await expect(page.getByText('Find your season')).toBeVisible();

  await page.getByRole('link', { name: 'Dress' }).click();
  await expect(page.getByRole('heading', { name: 'Dress' })).toBeVisible();
});

test('switches outfit and remembers it after a reload', async ({ page }) => {
  await page.goto('/');
  const top = page.locator('[data-slot="Top"]');
  const bottom = page.locator('[data-slot="Bottom"]');
  await expect(top).toHaveText('T-shirt');
  await expect(bottom).toHaveText('Trousers');

  await page.getByRole('button', { name: 'Next top' }).click();
  await expect(top).toHaveText('Sweatshirt');
  await page.reload();
  await expect(top).toHaveText('Sweatshirt');
  await page.getByRole('button', { name: 'Next top' }).click();
  await expect(top).toHaveText('None');
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await expect(bottom).toHaveText('Shorts');
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await expect(bottom).toHaveText('None');

  await page.reload();
  await expect(top).toHaveText('None');
  await expect(bottom).toHaveText('None');

  await page.getByRole('button', { name: 'Previous top' }).click();
  await expect(top).toHaveText('Sweatshirt');
  await page.getByRole('button', { name: 'Previous top' }).click();
  await expect(top).toHaveText('T-shirt');
});

test('sets the tee colour, keeps the trousers colour, and remembers it after a reload', async ({ page }) => {
  await page.goto('/');
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
  await expect(page.getByLabel('Top colour')).toHaveValue('#2e5e8c');
  await expect(page.getByLabel('Bottom colour')).toHaveValue('#d6d6d6');
});
