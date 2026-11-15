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
