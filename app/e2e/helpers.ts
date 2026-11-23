import { expect, type Page } from '@playwright/test';

/** Opens the change-a-piece panel for a slot (V1.2-04) and waits for it. */
export async function openSlot(page: Page, slot: 'Top' | 'Bottom' | 'Legs' | 'Under' | 'Shoes') {
  await page.locator(`.wear-row[data-row="${slot}"]`).click();
  await expect(page.getByRole('dialog', { name: slot })).toBeVisible();
}

/** Closes the panel with Done and waits until it has gone. */
export async function closeSlot(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** A garment choice in the open panel, such as "Sweatshirt" or "Nothing". "Shirt, long sleeves" taps the Shirt chip, then Long (V3-11). */
export const garment = (page: Page, name: string) => {
  const m = /^Shirt, (short|mid|long) sleeves$/.exec(name);
  const chip = (n: string) => page.getByRole('radiogroup', { name: 'Garment' }).getByRole('radio', { name: n, exact: true });
  if (!m) return chip(name);
  const long = m[1][0].toUpperCase() + m[1].slice(1);
  const variant = page.getByRole('radiogroup', { name: 'Sleeves' }).getByRole('radio', { name: long, exact: true });
  const loc = chip('Shirt');
  // Tapping this selects the Shirt chip and then the sleeve length.
  const click = loc.click.bind(loc);
  const clickVariant = variant.click.bind(variant);
  return Object.assign(variant, {
    click: async (...args: Parameters<typeof loc.click>) => {
      await click(...args);
      await clickVariant(...args);
    },
  });
};

/** The neckline group and one of its choices in the open panel. */
export const necklines = (page: Page) => page.getByRole('radiogroup', { name: 'Neckline' });
export const neckline = (page: Page, name: string) => necklines(page).getByRole('radio', { name, exact: true });

/** "Choose a colour" in the open panel, which opens the built-in chooser (V1.2-05). */
export const chooseButton = (page: Page) => page.getByRole('button', { name: /^Colour(, |$)/ });

/** The chooser's Back button ("‹ Top colour"). */
export const chooserBack = (page: Page) => page.getByRole('button', { name: /^Back to the/ });

/** Sets the open slot's colour by typing its code into the chooser, then goes back to the slot's controls. */
export async function setColour(page: Page, hex: string) {
  await chooseButton(page).click();
  await openFineTune(page);
  await page.getByLabel('Colour code').fill(hex);
  await chooserBack(page).click();
  await expectColour(page, hex);
}

/** The slot's controls show this colour on the swatch (the swatch reads "Current colour #xxxxxx"). */
export const expectColour = (page: Page, hex: string) => expect(page.getByRole('button', { name: new RegExp(`^Colour, .*${hex.toLowerCase()}$`) })).toBeVisible();

/** Opens the collapsed Fine-tune section of the colour page (code field and sliders). */
export async function openFineTune(page: Page) {
  const t = page.getByRole('button', { name: 'Fine-tune colour' });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
}

export const favourite = (page: Page) => page.locator('button[aria-label="Save colour to favourites"]:visible');
export const favouriteTiles = (page: Page) => page.getByRole('group', { name: 'Favourite colours' });
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

/** Writes keys straight into a device database (a fixture, not real data). Joe's by default; `huedrobe` is the database from before V2-06. */
export async function seedStore(page: Page, data: Record<string, unknown>, db = 'huedrobe-joe') {
  await page.evaluate(
    ([d, name]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name, 1);
        open.onupgradeneeded = () => open.result.createObjectStore('kv');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('kv', 'readwrite');
          for (const [k, v] of Object.entries(d)) tx.objectStore('kv').put(v, k);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [data, db] as [Record<string, unknown>, string],
  );
}

/** Writes saved clothes and outfits straight into Joe's device store (a fixture, not real data), then reloads. */
export async function seedWardrobe(page: Page, items: unknown[], outfits: unknown[] = []) {
  await seedStore(page, { wardrobe: items, outfits });
  await page.reload();
}

/** Makes the app's /api/me answer as this person, as the server does from IAP's header. `null` makes it unreachable (offline). */
export async function signInAs(page: Page, person: string | null) {
  await page.unroute('**/api/me');
  await page.route('**/api/me', (r) =>
    person ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ person }) }) : r.abort('internetdisconnected'),
  );
}
