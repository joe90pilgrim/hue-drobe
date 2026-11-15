import { expect, test } from '@playwright/test';

test('opens on Dress and moves between the two screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dress' })).toBeVisible();
  await expect(page.getByText('Sweatshirt')).toBeVisible();

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
  await expect(top).toHaveText('None');
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await expect(bottom).toHaveText('None');

  await page.reload();
  await expect(top).toHaveText('None');
  await expect(bottom).toHaveText('None');

  await page.getByRole('button', { name: 'Previous top' }).click();
  await expect(top).toHaveText('T-shirt');
});
