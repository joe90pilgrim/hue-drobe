import { expect, test } from '@playwright/test';
import { closeSlot, garment, openSlot, setColour } from './helpers';

// V1.2-03: Try on layout.

test('on a phone the stage uses the full width and each row is at least 64 px high', async ({ page }) => {
  await page.goto('/#/try-on');
  const stage = await page.locator('#stage').boundingBox();
  expect(stage!.x).toBe(0);
  expect(stage!.width).toBe(412);
  const rows = page.locator('.wear-row');
  await expect(rows).toHaveCount(9); // Hat, Outer, Dress, Top, Bottom, Legs, Under, Shoes and Hair (the hat, outer, dress, under, shoes and hair rows are hidden unless the pack allows them)
  // The hair pill (V5-04) sits on the stage, not in the list, and is a 44 px touch target; every row in the list is at least 64 px.
  for (const row of await rows.all()) if (await row.isVisible()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual((await row.getAttribute('data-row')) === 'Hair' ? 44 : 64);
  await expect(page.locator('[data-slot="Top"]')).toHaveText('T-shirt, crew neck');
  expect((await page.getByRole('button', { name: 'Save outfit' }).boundingBox())!.height).toBe(50);
});

test('no developer instruction shows without ?debug, and the hint goes after the first drag', async ({ page }) => {
  await page.goto('/#/try-on');
  await page.getByRole('radio', { name: '3D' }).click(); // V8-01: the hint belongs to the 3D view
  await expect(page.locator('.stage-status')).not.toHaveText('Getting your avatar ready…');
  await expect(page.locator('.stage-status')).not.toContainText('build_pack');
  await expect(page.locator('.stage-status')).not.toContainText('Run:');
  const hint = page.locator('.stage-hint');
  // The hint shows once the avatar has loaded (if the pack is not served in this build, the status message shows instead).
  if (await hint.isVisible()) {
    await expect(hint).toHaveText('Drag to turn · pinch to zoom'); // the test phone has touch
    const box = (await page.locator('#stage').boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 110, { steps: 4 });
    await page.mouse.up();
    await expect(hint).toBeHidden();
  }
});

test('on a laptop the stage and the panel fill the screen at 1280 x 800', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#/try-on');
  const stage = (await page.locator('#stage').boundingBox())!;
  const panel = (await page.locator('.panel').boundingBox())!;
  expect(panel.width).toBeGreaterThanOrEqual(360);
  expect(panel.width).toBeLessThanOrEqual(420);
  expect(stage.height).toBeGreaterThan(700);
  expect(stage.x + stage.width).toBeLessThan(panel.x);
  expect(panel.x + panel.width).toBeGreaterThan(1280 - 40);
});

// V1.2-04: change a piece.

test('on a phone a row opens a sheet under a smaller stage, in order garment, neckline, colour, add; Done returns the focus', async ({ page }) => {
  await page.goto('/#/try-on');
  await expect(page.locator('.stage-status')).toHaveAttribute('hidden', ''); // layout settles once the pack has loaded (in 2D the status is never shown, so read its own flag)
  const before = (await page.locator('#stage').boundingBox())!;
  await page.locator('.wear-row[data-row="Top"]').click();
  const dialog = page.getByRole('dialog', { name: 'Top' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'T-shirt' })).toBeFocused();

  const stage = (await page.locator('#stage').boundingBox())!;
  const sheet = (await dialog.boundingBox())!;
  expect(stage.width).toBe(412);
  expect(stage.height).toBeGreaterThan(150);
  // V5-02: with a Hat row too, the list is taller than the sheet on a pack that has shoes and hats, so the stage at rest can already be smaller than with the sheet open; it must still not shrink.
  expect(stage.height).toBeGreaterThanOrEqual(Math.min(before.height, 240));
  expect(stage.y + stage.height).toBeLessThanOrEqual(sheet.y + 1); // the sheet does not cover the stage

  const y = async (locator: ReturnType<typeof page.locator>) => (await locator.first().boundingBox())!.y;
  const garmentY = await y(dialog.getByRole('radiogroup', { name: 'Garment' }));
  const neckY = await y(dialog.getByRole('radiogroup', { name: 'Neckline' }));
  const colourY = await y(dialog.getByRole('button', { name: 'Save colour to favourites', exact: true }));
  const addY = await y(dialog.getByRole('button', { name: 'Add to wardrobe' }));
  expect(garmentY).toBeLessThan(neckY);
  expect(neckY).toBeLessThan(colourY);
  expect(colourY).toBeLessThan(addY);

  // Every control is at least 44 px high.
  for (const c of await dialog.locator('button:visible, input:visible, [role="radio"]:visible').all()) {
    const box = (await c.boundingBox())!;
    expect(box.height, await c.evaluate((e) => e.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(44);
  }

  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.wear-row[data-row="Top"]')).toBeFocused();
  expect((await page.locator('#stage').boundingBox())!.height).toBe(before.height);
});

test('the back gesture and a tap on the stage close the sheet', async ({ page }) => {
  await page.goto('/#/try-on');
  const dialog = page.getByRole('dialog');
  await page.locator('.wear-row[data-row="Bottom"]').click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/#\/try-on$/);
  await expect(page.locator('.wear-row[data-row="Bottom"]')).toBeFocused();

  await page.locator('.wear-row[data-row="Bottom"]').click();
  await expect(dialog).toBeVisible();
  const box = (await page.locator('#stage').boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 20);
  await expect(dialog).toBeHidden();

  await page.locator('.wear-row[data-row="Bottom"]').click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('the word Save appears only in Save outfit on Try on', async ({ page }) => {
  await page.goto('/#/try-on');
  const saves = () => page.locator('.try-on').evaluate((e) => (e.textContent!.match(/\bSave\b/g) ?? []).length);
  expect(await saves()).toBe(1);
  await page.locator('.wear-row[data-row="Top"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await saves()).toBe(1);
  await expect(page.getByRole('button', { name: 'Save outfit' })).toBeHidden(); // the sheet takes its place on a phone
});

test('on a laptop the controls open in the panel in place of the row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#/try-on');
  const stageBefore = (await page.locator('#stage').boundingBox())!;
  await page.locator('.wear-row[data-row="Top"]').click();
  const dialog = page.locator('.panel').getByRole('dialog', { name: 'Top' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.wear-row[data-row="Top"]')).toBeHidden();
  await expect(page.locator('.wear-row[data-row="Bottom"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save outfit' })).toBeVisible();
  expect(await page.locator('#stage').boundingBox()).toEqual(stageBefore);
  const panel = (await page.locator('.panel').boundingBox())!;
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(panel.x);
  expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
  expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height);

  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.wear-row[data-row="Top"]')).toBeFocused();
});

// V8-01: the 2D paper-doll is the default view; 3D is one tap away.

test('Try on opens on the 2D doll with the 3D render loop paused, and the switch changes views by touch and keyboard', async ({ page }) => {
  // Counts the animation frames that run, to show the 3D loop draws none while the doll is showing.
  await page.addInitScript(() => {
    const w = window as unknown as { frames: number };
    const raf = window.requestAnimationFrame.bind(window);
    w.frames = 0;
    window.requestAnimationFrame = (cb) => raf((t) => { w.frames++; cb(t); });
  });
  const frames = () => page.evaluate(() => (window as unknown as { frames: number }).frames);
  const framesOver = async (ms: number) => { const a = await frames(); await page.waitForTimeout(ms); return (await frames()) - a; };
  await page.goto('/#/try-on');
  const doll = page.locator('.doll svg');
  const canvas = page.locator('#stage canvas');
  const view = page.getByRole('radiogroup', { name: 'View' });
  await expect(doll).toBeVisible();
  await expect(doll).toHaveAttribute('data-figure', 'joe');
  await expect(view.getByRole('radio', { name: '2D' })).toHaveAttribute('aria-checked', 'true');
  await expect(canvas).toBeHidden();
  await expect(page.locator('.stage-status')).toHaveAttribute('hidden', ''); // the pack has loaded behind the doll
  const in2d = await framesOver(600);
  console.log(`animation frames in 600 ms: 2D ${in2d}`);
  expect(in2d).toBe(0);

  // The switch sits top-right of the stage, and each side is a 44 px touch target.
  const stage = (await page.locator('#stage').boundingBox())!;
  const seg = (await view.boundingBox())!;
  expect(seg.x + seg.width).toBeGreaterThan(stage.x + stage.width - 20);
  expect(seg.y).toBeLessThan(stage.y + 20);
  for (const r of await view.getByRole('radio').all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await view.getByRole('radio', { name: '3D' }).click();
  await expect(canvas).toBeVisible();
  await expect(doll).toBeHidden();
  await expect(page.locator('.stage-hint')).toBeVisible();
  const in3d = await framesOver(600);
  console.log(`animation frames in 600 ms: 3D ${in3d}`);
  expect(in3d).toBeGreaterThan(5);

  await view.getByRole('radio', { name: '3D' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(view.getByRole('radio', { name: '2D' })).toHaveAttribute('aria-checked', 'true');
  await expect(view.getByRole('radio', { name: '2D' })).toBeFocused();
  await expect(doll).toBeVisible();
  await expect(canvas).toBeHidden();
});

test('a change in either view shows on the doll', async ({ page }) => {
  await page.goto('/#/try-on');
  const view = page.getByRole('radiogroup', { name: 'View' });
  await expect(page.locator('.doll [data-layer="top"]')).toHaveAttribute('data-garment', 'tee');
  await openSlot(page, 'Bottom'); // in 2D: the doll changes at once
  await garment(page, 'Shorts').click();
  await expect(page.locator('.doll [data-layer="bottom"]')).toHaveAttribute('data-garment', 'shorts');
  await closeSlot(page);

  await view.getByRole('radio', { name: '3D' }).click(); // in 3D: the doll is right when 2D is shown again
  await openSlot(page, 'Top');
  await garment(page, 'Sweatshirt').click();
  await closeSlot(page);
  await view.getByRole('radio', { name: '2D' }).click();
  await expect(page.locator('.doll [data-layer="top"]')).toHaveAttribute('data-garment', 'sweatshirt');
  await expect(page.locator('.doll [data-layer="bottom"]')).toHaveAttribute('data-garment', 'shorts');
  expect(await page.locator('.try-on').evaluate((e) => (e.textContent!.match(/\bSave\b/g) ?? []).length)).toBe(1);
});

// V9-01: patterns. Nothing is drawn yet (V9-02); the editor only chooses and remembers them.

const patternGroup = (page: import('@playwright/test').Page) => page.getByRole('radiogroup', { name: 'Pattern', exact: true });
const patternColourButton = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Pattern colour, / });

test('the Pattern row follows Colour and comes before Add to wardrobe; a pattern brings a contrasting Pattern colour button, and both are remembered', async ({ page }) => {
  await page.goto('/#/try-on');
  await openSlot(page, 'Top');
  const dialog = page.getByRole('dialog', { name: 'Top' });
  await setColour(page, '#1f2a5a');
  await expect(patternGroup(page).getByRole('radio')).toHaveText(['Plain', 'Horizontal stripes', 'Vertical stripes', 'Spots', 'Flowers']);
  await expect(patternGroup(page).getByRole('radio', { name: 'Plain' })).toBeChecked();
  await expect(patternColourButton(page)).toBeHidden();

  await patternGroup(page).getByRole('radio', { name: 'Horizontal stripes' }).click();
  await expect(patternColourButton(page)).toHaveAccessibleName('Pattern colour, White, #ffffff'); // a light colour on a dark base
  await setColour(page, '#f2ede3'); // the base moves to a light colour; the pattern colour stays as chosen
  await expect(patternColourButton(page)).toHaveAccessibleName('Pattern colour, White, #ffffff');

  const y = async (locator: ReturnType<typeof page.locator>) => (await locator.first().boundingBox())!.y;
  const colourY = await y(dialog.getByRole('button', { name: 'Save colour to favourites', exact: true }));
  const patternY = await y(patternGroup(page));
  const patternColourY = await y(patternColourButton(page));
  const addY = await y(dialog.getByRole('button', { name: 'Add to wardrobe' }));
  expect(colourY).toBeLessThan(patternY);
  expect(patternY).toBeLessThan(patternColourY);
  expect(patternColourY).toBeLessThan(addY);
  for (const c of [patternGroup(page).getByRole('radio'), patternColourButton(page)]) for (const e of await c.all()) expect((await e.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByText('Save', { exact: true })).toHaveCount(0); // "Save" appears once on Try On, in "Save outfit"

  await patternGroup(page).getByRole('radio', { name: 'Spots' }).click();
  await expect(patternColourButton(page)).toBeVisible(); // changing pattern keeps the colour button
  await page.waitForTimeout(300); // the choice is saved in the background
  await page.reload();
  await openSlot(page, 'Top');
  await expect(patternGroup(page).getByRole('radio', { name: 'Spots' })).toBeChecked();
  await expect(patternColourButton(page)).toHaveAccessibleName('Pattern colour, White, #ffffff');
  await patternGroup(page).getByRole('radio', { name: 'Plain' }).click();
  await expect(patternColourButton(page)).toBeHidden();
});
