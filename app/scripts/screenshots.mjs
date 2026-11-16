// Captures every screen of the running app at phone and desktop sizes into docs/screenshots/.
// Usage: node scripts/screenshots.mjs [baseUrl]   (default http://localhost:5174, start `npm run dev` first)
// Joe's private avatar pack is blocked on purpose, so no personal body shape is ever written into a committed image.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5174';
const out = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
mkdirSync(out, { recursive: true });

const sizes = {
  mobile: { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};

const browser = await chromium.launch();
let count = 0;

for (const [size, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/pack/**', (r) => r.abort());
  const page = await ctx.newPage();
  let n = 0;
  const shot = async (name) => {
    await page.waitForTimeout(300);
    n += 1;
    await page.screenshot({ path: `${out}${size}-${String(n).padStart(2, '0')}-${name}.png` });
    count += 1;
  };
  const go = async (hash) => {
    await page.goto(`${base}/#/${hash}`);
    await page.reload();
  };

  // Wardrobe, empty
  await go('wardrobe');
  await shot('wardrobe-empty');

  // Dress: default, then a coloured look
  await go('dress');
  await shot('dress-default');
  await page.getByLabel('Top colour').fill('#1f2a5a');
  await page.getByLabel('Bottom colour').fill('#6b4f3a');
  await shot('dress-colours-chosen');
  await page.locator('[data-save="Top"]').click();
  await page.locator('[data-save="Bottom"]').click();
  await page.getByRole('button', { name: 'Save outfit' }).click();
  await page.waitForTimeout(400);
  await shot('dress-saved-with-favourites');

  const neck = page.locator('[data-neckline]').nth(1);
  if (await neck.isVisible()) {
    await neck.click();
    await shot('dress-neckline-changed');
  }
  await page.getByRole('button', { name: 'Next top' }).click();
  await shot('dress-sweatshirt');
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await shot('dress-shorts');
  await page.getByRole('button', { name: 'Next top' }).click();
  await page.getByRole('button', { name: 'Next bottom' }).click();
  await shot('dress-nothing-worn');

  // Wardrobe, with a saved item and outfit, then in rename mode
  await page.getByRole('link', { name: 'Wardrobe' }).click();
  await shot('wardrobe-saved');
  const rename = page.getByRole('button', { name: /^Rename/ }).first();
  if (await rename.isVisible()) {
    await rename.click();
    await shot('wardrobe-renaming');
    await page.getByRole('button', { name: 'Done' }).first().click();
  }

  // Colour quiz: intro, a question, a later question, result, close second
  await go('colour');
  await shot('colour-intro');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await shot('colour-question-1');
  const total = await page.evaluate(() => 0).then(() => null);
  let i = 0;
  for (;;) {
    i += 1;
    await page.getByRole('radio').first().click();
    if (i === 3) await shot('colour-question-answered');
    const see = page.getByRole('button', { name: 'See my result' });
    if (await see.isVisible()) {
      await see.click();
      break;
    }
    await page.getByRole('button', { name: 'Next' }).click();
  }
  void total;
  await shot('colour-result');
  await page.locator('[data-fav]').first().click();
  await page.locator('[data-fav]').nth(2).click();
  await page.mouse.wheel(0, 2000);
  await shot('colour-result-lower');
  await page.evaluate(() => window.scrollTo(0, 0));
  const second = page.getByRole('button', { name: 'See this palette' });
  if (await second.isVisible()) {
    await second.click();
    await shot('colour-close-second');
  }

  // Dress again: palette colours now appear as favourites
  await page.getByRole('link', { name: 'Dress' }).click();
  await shot('dress-palette-favourites');

  await ctx.close();
}
await browser.close();
console.log(`${count} screenshots written to ${out}`);
