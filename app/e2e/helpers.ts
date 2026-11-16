import { expect, type Page } from '@playwright/test';

/** Opens the change-a-piece panel for a slot (V1.2-04) and waits for it. */
export async function openSlot(page: Page, slot: 'Top' | 'Bottom') {
  await page.locator(`.wear-row[data-row="${slot}"]`).click();
  await expect(page.getByRole('dialog', { name: slot })).toBeVisible();
}

/** Closes the panel with Done and waits until it has gone. */
export async function closeSlot(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** A garment choice in the open panel, such as "Sweatshirt" or "Nothing". */
export const garment = (page: Page, name: string) => page.getByRole('radiogroup', { name: 'Garment' }).getByRole('radio', { name, exact: true });

/** The neckline group and one of its choices in the open panel. */
export const necklines = (page: Page) => page.getByRole('radiogroup', { name: 'Neckline' });
export const neckline = (page: Page, name: string) => necklines(page).getByRole('radio', { name, exact: true });

/** The colour input behind "Choose a colour". */
export const colourInput = (page: Page) => page.getByLabel('Choose a colour');
export const favourite = (page: Page) => page.getByRole('button', { name: 'Favourite', exact: true });
export const favouriteTiles = (page: Page) => page.getByRole('group', { name: 'Your favourite colours' });
export const addToWardrobe = (page: Page) => page.getByRole('button', { name: 'Add to wardrobe', exact: true });
export const inWardrobe = (page: Page) => page.getByRole('button', { name: 'In your wardrobe', exact: true });
