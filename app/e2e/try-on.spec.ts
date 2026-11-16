import { expect, test } from '@playwright/test';

// V1.2-03: Try on layout.

test('on a phone the stage uses the full width and each row is at least 64 px high', async ({ page }) => {
  await page.goto('/#/try-on');
  const stage = await page.locator('#stage').boundingBox();
  expect(stage!.x).toBe(0);
  expect(stage!.width).toBe(412);
  const rows = page.locator('.wear-row');
  await expect(rows).toHaveCount(3); // Top, Bottom and Legs (V2-04)
  for (const row of await rows.all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(64);
  await expect(page.locator('[data-slot="Top"]')).toHaveText('T-shirt, crew neck');
  expect((await page.getByRole('button', { name: 'Save outfit' }).boundingBox())!.height).toBe(50);
});

test('no developer instruction shows without ?debug, and the hint goes after the first drag', async ({ page }) => {
  await page.goto('/#/try-on');
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
  const before = (await page.locator('#stage').boundingBox())!;
  await page.locator('.wear-row[data-row="Top"]').click();
  const dialog = page.getByRole('dialog', { name: 'Top' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'T-shirt' })).toBeFocused();

  const stage = (await page.locator('#stage').boundingBox())!;
  const sheet = (await dialog.boundingBox())!;
  expect(stage.width).toBe(412);
  expect(stage.height).toBeGreaterThan(150);
  expect(stage.height).toBeLessThan(before.height);
  expect(stage.y + stage.height).toBeLessThanOrEqual(sheet.y + 1); // the sheet does not cover the stage

  const y = async (locator: ReturnType<typeof page.locator>) => (await locator.first().boundingBox())!.y;
  const garmentY = await y(dialog.getByRole('radiogroup', { name: 'Garment' }));
  const neckY = await y(dialog.getByRole('radiogroup', { name: 'Neckline' }));
  const colourY = await y(dialog.getByRole('button', { name: 'Favourite', exact: true }));
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
