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

/** "Choose a colour" in the open panel, which opens the built-in chooser (V1.2-05). */
export const chooseButton = (page: Page) => page.getByRole('button', { name: 'Choose a colour', exact: true });

/** The chooser's Back button ("‹ Top colour"). */
export const chooserBack = (page: Page) => page.getByRole('button', { name: /^Back to the/ });

/** Sets the open slot's colour by typing its code into the chooser, then goes back to the slot's controls. */
export async function setColour(page: Page, hex: string) {
  await chooseButton(page).click();
  await page.getByLabel('Colour code').fill(hex);
  await chooserBack(page).click();
  await expectColour(page, hex);
}

/** The slot's controls show this colour on the swatch (the swatch reads "Current colour #xxxxxx"). */
export const expectColour = (page: Page, hex: string) => expect(page.getByRole('img', { name: `Current colour ${hex.toLowerCase()}` })).toBeVisible();

export const favourite = (page: Page) => page.getByRole('button', { name: 'Favourite', exact: true });
export const favouriteTiles = (page: Page) => page.getByRole('group', { name: 'Your favourite colours' });
export const addToWardrobe = (page: Page) => page.getByRole('button', { name: 'Add to wardrobe', exact: true });
export const inWardrobe = (page: Page) => page.getByRole('button', { name: 'In your wardrobe', exact: true });

/** A card in the Wardrobe grid, found by its exact name. */
export const card = (page: Page, name: string) => page.locator('.w-card').filter({ has: page.getByText(name, { exact: true }) });

/** Taps a Wardrobe card and waits for the sheet (phone) or panel (laptop) that holds its actions. */
export async function openCard(page: Page, name: string) {
  await card(page, name).click();
  await expect(page.getByRole('button', { name: 'Try it on' })).toBeVisible();
}

/** Taps a card, then "Try it on", and waits for the Try on screen. */
export async function tryItOn(page: Page, name: string) {
  await openCard(page, name);
  await page.getByRole('button', { name: 'Try it on' }).click();
  await expect(page).toHaveURL(/#\/try-on/);
}

/** Taps a card, then Delete, then Delete in the question that follows. */
export async function deleteCard(page: Page, name: string) {
  await openCard(page, name);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog', { name: /^Delete / }).getByRole('button', { name: 'Delete', exact: true }).click();
}

/** The Wardrobe's Clothes and Outfits switch. */
export const wardrobeTab = (page: Page, name: 'Clothes' | 'Outfits') => page.getByRole('tab', { name: new RegExp(`^${name} · [0-9]+$`) });

/** Writes saved clothes and outfits straight into the device store (a fixture, not real data), then reloads. */
export async function seedWardrobe(page: Page, items: unknown[], outfits: unknown[] = []) {
  await page.evaluate(
    ([i, o]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('huedrobe', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('kv');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(i, 'wardrobe');
          tx.objectStore('kv').put(o, 'outfits');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    [items, outfits] as [unknown[], unknown[]],
  );
  await page.reload();
}
