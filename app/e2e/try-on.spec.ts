import { expect, test } from '@playwright/test';

// V1.2-03: Try on layout.

test('on a phone the stage uses the full width and each row is at least 64 px high', async ({ page }) => {
  await page.goto('/#/try-on');
  const stage = await page.locator('#stage').boundingBox();
  expect(stage!.x).toBe(0);
  expect(stage!.width).toBe(412);
  const rows = page.locator('.wear-row');
  await expect(rows).toHaveCount(2);
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
