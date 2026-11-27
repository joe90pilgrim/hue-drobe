import { expect, test } from '@playwright/test';
import { addToWardrobe, card, closeSlot, expectColour, garment, inWardrobe, openCard, openSlot, seedWardrobe, setColour, tryItOn, wardrobeTab } from './helpers';

test('adds a tee to the wardrobe, renames it, wears it from the library, and keeps it after a reload', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await setColour(page, '#1f2a5a');
  await addToWardrobe(page).click();
  await expect(inWardrobe(page)).toBeVisible();
  await setColour(page, '#1f2a5b'); // a change means this is not the added one any more
  await expect(addToWardrobe(page)).toBeVisible();
  await setColour(page, '#1f2a5a');
  await expect(inWardrobe(page)).toBeVisible();

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(card(page, 'Navy tee')).toBeVisible();
  await expect(wardrobeTab(page, 'Clothes')).toHaveText('Clothes · 1');

  // Rename from the sheet: Escape cancels the rename, Enter saves it.
  await openCard(page, 'Navy tee');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Name').fill('Nope');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Navy tee' })).toBeVisible();
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Name').fill('Work tee');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Work tee' })).toBeVisible();
  await page.keyboard.press('Escape'); // closes the sheet
  await expect(card(page, 'Work tee')).toBeVisible();

  // Change the avatar, then wear the saved item and check it comes back.
  await page.getByRole('link', { name: 'Try on' }).click();
  await openSlot(page, 'Top');
  await setColour(page, '#aa5500');
  await garment(page, 'Sweatshirt').click();
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await page.reload();
  await tryItOn(page, 'Work tee');
  await expect(page.locator('[data-slot="Top"]')).toHaveText('T-shirt, crew neck');
  await openSlot(page, 'Top');
  await expectColour(page, '#1f2a5a');
});

test('hides Add to wardrobe when nothing is worn, and deletes a saved item only after asking', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Bottom');
  await expect(addToWardrobe(page)).toBeVisible();
  await garment(page, 'Nothing').click();
  await expect(addToWardrobe(page)).toBeHidden();
  await garment(page, 'Trousers').click();
  await addToWardrobe(page).click(); // trousers, default colour
  await expect(inWardrobe(page)).toBeVisible();
  await closeSlot(page);
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0); // no Delete on the card itself

  await openCard(page, 'Light grey trousers');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const ask = page.getByRole('dialog', { name: 'Delete Light grey trousers?' });
  await expect(ask).toContainText('Outfits that use it will show a gap where it was.');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(ask).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Light grey trousers' })).toBeVisible(); // Cancel keeps the sheet and the piece

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await ask.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Nothing here yet. On Try on, change a piece and tap Add to wardrobe.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Nothing here yet. On Try on, change a piece and tap Add to wardrobe.')).toBeVisible();
});

// A fixture, not real data: 20 pieces, tops and bottoms mixed.
const fixture = Array.from({ length: 20 }, (_, n) => {
  const garment = (['tee', 'sweatshirt', 'trousers', 'shorts'] as const)[n % 4];
  const hex = '#' + (0x202020 + n * 0x0a0b0c).toString(16).padStart(6, '0');
  return { v: 2, id: `fx-${n}`, garment, ...(garment === 'tee' && { neckline: 'crew' }), colour: hex, name: `Piece ${n + 1}`, savedAt: 1000 + n };
});

test('with 20 saved pieces the grid fits several on a screen and can be cut down to tops or bottoms', async ({ page }) => {
  await page.goto('/#/wardrobe');
  await seedWardrobe(page, fixture);
  await expect(page.locator('.w-card')).toHaveCount(20);
  await expect(wardrobeTab(page, 'Clothes')).toHaveText('Clothes · 20');
  await expect(page.getByRole('button', { name: 'Tops · 10' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bottoms · 10' })).toBeVisible();

  // V3-16: in All, each group is one sliding rail. Cards in a rail share a row, the rail runs past the screen edge but
  // not the page, and the next group's rail sits below it. Several cards are in view at once.
  const box = async (n: number) => (await page.locator('.w-card').nth(n).boundingBox())!;
  const [a, b, c, first2] = [await box(0), await box(1), await box(2), await box(10)];
  expect(b.y).toBeCloseTo(a.y, 0);
  expect(c.y).toBeCloseTo(a.y, 0);
  expect(first2.y).toBeGreaterThan(a.y);
  const inView = await page.locator('.w-card').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.right <= window.innerWidth && r.bottom <= window.innerHeight; }).length);
  expect(inView).toBeGreaterThanOrEqual(6);
  expect(await page.locator('.c-row.slide').first().evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);

  await page.getByRole('button', { name: 'Tops · 10' }).click();
  await expect(page.locator('.w-card')).toHaveCount(10);
  await expect(page.getByRole('button', { name: 'Tops · 10' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.w-card .w-sub').first()).toHaveText(/T-shirt|Sweatshirt/);
  await page.getByRole('button', { name: 'Bottoms · 10' }).click();
  await expect(page.locator('.w-card')).toHaveCount(10);
  await expect(page.locator('.w-card .w-sub').first()).toHaveText(/Trousers|Shorts/);
  await page.getByRole('button', { name: 'All' }).click();
  await expect(page.locator('.w-card')).toHaveCount(20);
});

test('on a laptop the grid uses the width and a card opens a panel beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#/wardrobe');
  await seedWardrobe(page, fixture);
  await expect(page.locator('.w-card')).toHaveCount(20);
  const firstRow = await page.locator('.w-card').evaluateAll((els) => {
    const top = els[0].getBoundingClientRect().top;
    return els.filter((e) => e.getBoundingClientRect().top === top).length;
  });
  expect(firstRow).toBeGreaterThanOrEqual(4);
  // V3-16: rails wrap rather than slide, so nothing scrolls sideways and the 10 tops take more than one row.
  expect(firstRow).toBeLessThan(10);
  expect(await page.locator('.c-row').first().evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);

  await card(page, 'Piece 1').click();
  const panel = page.locator('.w-panel');
  await expect(panel).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0); // a panel, not a sheet
  const w = (await panel.boundingBox())!.width;
  expect(w).toBeGreaterThanOrEqual(280);
  expect(w).toBeLessThanOrEqual(340);
  await expect(card(page, 'Piece 1')).toHaveAttribute('aria-pressed', 'true');
  expect(await card(page, 'Piece 1').evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('2px');

  await panel.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Name').fill('First');
  await page.keyboard.press('Enter');
  await expect(card(page, 'First')).toBeVisible();
  await panel.getByRole('button', { name: 'Try it on' }).click();
  await expect(page).toHaveURL(/#\/try-on/);
});

// V9-01: patterns are part of a saved piece.

test('the same tee in a different pattern is a separate item, and a plain item worn after a patterned one leaves no pattern behind', async ({ page }) => {
  const pattern = (name: string) => page.getByRole('radiogroup', { name: 'Pattern', exact: true }).getByRole('radio', { name, exact: true });
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  await setColour(page, '#1f2a5a');
  await addToWardrobe(page).click(); // plain
  await expect(inWardrobe(page)).toBeVisible();
  await pattern('Horizontal stripes').click();
  await expect(addToWardrobe(page)).toBeVisible(); // a pattern means this is not the added one
  await addToWardrobe(page).click();
  await expect(inWardrobe(page)).toBeVisible();
  await pattern('Vertical stripes').click();
  await addToWardrobe(page).click();
  await expect(inWardrobe(page)).toBeVisible();

  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await expect(wardrobeTab(page, 'Clothes')).toHaveText('Clothes · 3');
  await expect(card(page, 'Navy tee')).toBeVisible();
  await expect(card(page, 'Navy striped tee')).toBeVisible();
  await expect(card(page, 'Navy pinstriped tee')).toBeVisible();

  await tryItOn(page, 'Navy striped tee');
  await openSlot(page, 'Top');
  await expect(pattern('Horizontal stripes')).toBeChecked();
  await closeSlot(page);
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await tryItOn(page, 'Navy tee');
  await openSlot(page, 'Top');
  await expect(pattern('Plain')).toBeChecked();
});

// V9-02: a saved patterned piece shows its pattern on the closet tile, the sheet and the outfit flat-lay.

test('a saved patterned piece shows its pattern on its tile, in its sheet and in an outfit', async ({ page }) => {
  await page.goto('/#/wardrobe');
  const tee = { v: 2, id: 'stripy', garment: 'tee', colour: '#1f2a5a', pattern: 'hstripes', patternColour: '#ffffff', name: 'Stripy', savedAt: 1 };
  const plain = { v: 2, id: 'plain', garment: 'trousers', colour: '#c8c8c8', name: 'Plain trousers', savedAt: 2 };
  await seedWardrobe(page, [tee, plain], [{ v: 1, id: 'o', name: 'Look', top: 'stripy', bottom: 'plain', savedAt: 3 }]);
  await expect(card(page, 'Stripy').locator('svg pattern')).toHaveCount(1);
  await expect(card(page, 'Plain trousers').locator('svg pattern')).toHaveCount(0);
  await openCard(page, 'Stripy');
  await expect(page.getByRole('heading', { name: 'Stripy' })).toBeVisible();
  await expect(page.locator('.w-sheet svg pattern, .w-panel svg pattern').first()).toBeAttached();
  await page.keyboard.press('Escape');
  await wardrobeTab(page, 'Outfits').click();
  await expect(page.locator('svg pattern')).toHaveCount(1); // the flat-lay: the tee's pattern, defined once; the trousers stay plain
});
