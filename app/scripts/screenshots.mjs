// Captures every screen of the running app into one folder, with the same sample wardrobe every run.
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir] [phoneSize]
//   baseUrl    default http://localhost:5174 (start `npm run dev` first)
//   outDir     default docs/screenshots/
//   phoneSize  default 412x915 (Pixel 8, shot at 2x). Use 390x844 to compare with the design files, which are 1x.
// Joe's private avatar pack is blocked on purpose, so no personal body shape is ever written into a committed image.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:5174';
const out = process.argv[3] ?? fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
const [phoneW, phoneH] = (process.argv[4] ?? '412x915').split('x').map(Number);
mkdirSync(out, { recursive: true });

const sizes = {
  phone: { viewport: { width: phoneW, height: phoneH }, hasTouch: true, isMobile: true, deviceScaleFactor: phoneW === 412 ? 2 : 1 },
  laptop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};

// Sample content, the same every run: clothes, three outfits (the last with a gap where a piece was deleted) and favourites.
const item = (id, garment, colour, name, savedAt, neckline) => ({ v: 2, id, garment, ...(neckline && { neckline }), colour, name, savedAt });
const SEED = {
  wardrobe: [
    item('i1', 'tee', '#1f2a5a', 'Navy tee', 6),
    item('i2', 'tee', '#f4f4f2', 'White tee', 5, 'v'),
    item('i3', 'trousers', '#6b4f3a', 'Brown trousers', 4),
    item('i4', 'sweatshirt', '#8c8c8c', 'Grey sweatshirt', 3),
    item('i5', 'shorts', '#b8ad98', 'Stone shorts', 2),
    item('i6', 'tee', '#1e7a55', 'Emerald tee', 1, 'scoop'),
  ],
  outfits: [
    { v: 1, id: 'o1', name: 'Weekend', top: 'i1', bottom: 'i3', savedAt: 3 },
    { v: 1, id: 'o2', name: 'Stone and grey', top: 'i4', bottom: 'i5', savedAt: 2 },
    { v: 1, id: 'o3', name: 'Emerald', top: 'i6', bottom: 'deleted', savedAt: 1 },
  ],
  outfit: { Top: 'T-shirt', Bottom: 'Trousers' },
  colours: { tee: '#1f2a5a', trousers: '#6b4f3a' },
  neckline: 'crew',
  favourites: [
    { hex: '#1f2a5a', fromPalette: false },
    { hex: '#6b4f3a', fromPalette: true },
    { hex: '#c8b89a', fromPalette: true },
  ],
};

const browser = await chromium.launch();
let count = 0;

for (const [size, opts] of Object.entries(sizes)) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/pack/**', (r) => r.abort());
  // The pack is blocked, so the stage would say the avatar failed to load. Hide that line: the stage is empty on purpose.
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.stage-status { visibility: hidden !important; }';
      document.head.append(style);
    });
  });
  const page = await ctx.newPage();
  let n = 0;
  const shot = async (name) => {
    await page.waitForTimeout(300);
    n += 1;
    await page.screenshot({ path: join(out, `${size}-${String(n).padStart(2, '0')}-${name}.png`) });
    count += 1;
  };
  const go = async (route) => {
    await page.goto(`${base}/#/${route}`);
    await page.reload();
  };

  // Put the sample content on the device, then reload so every screen reads it.
  await go('try-on');
  await page.evaluate(async (data) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('huedrobe', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite');
        for (const [key, value] of Object.entries(data)) tx.objectStore('kv').put(value, key);
        tx.oncomplete = () => { req.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, SEED);
  await go('try-on');
  await page.locator('.wear-row').first().waitFor();

  // Phone: the Try on screen, then one piece open, its colour chooser, then the menu.
  if (size === 'phone') {
    await shot('try-on');
    await page.locator('[data-row="Top"]').click();
    await page.locator('.editor').waitFor();
    await shot('change-a-piece');
    await page.locator('.choose').click();
    await shot('choose-a-colour');
    await page.locator('.editor-back').click();
    await page.locator('.editor-done').click();
    await page.locator('#menu-btn').click();
    await shot('menu-back-up');
    await page.keyboard.press('Escape');
  }

  // Laptop: the Try on screen with the Top section open in the panel, then the colour chooser, then back up.
  if (size === 'laptop') {
    await shot('try-on');
    await page.locator('[data-row="Top"]').click();
    await shot('change-a-piece');
    await page.locator('.choose').click();
    await shot('choose-a-colour');
    await page.locator('.editor-back').click();
    await page.locator('#backup-btn').click();
    await shot('back-up');
    await page.keyboard.press('Escape');
  }

  // Wardrobe: clothes, a piece tapped (sheet on a phone, panel on a laptop), then outfits.
  await go('wardrobe');
  await shot('wardrobe-clothes');
  await page.locator('.w-card').first().click();
  await shot('wardrobe-a-piece');
  if (size === 'phone') await page.keyboard.press('Escape');
  await page.locator('#tab-outfits').click();
  await shot('wardrobe-outfits');

  // My colours: before the quiz, a question, the result (and the palette further down).
  await go('colours');
  await shot('my-colours-start');
  await page.getByRole('button', { name: 'Take the quiz' }).click();
  for (let i = 0; i < 2; i += 1) {
    await page.locator('[role="radio"]').first().click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.locator('[role="radio"]').first().click();
  await shot('my-colours-question');
  for (;;) {
    await page.locator('[role="radio"]').first().click();
    const see = page.getByRole('button', { name: 'See my result' });
    if (await see.isVisible()) {
      await see.click();
      break;
    }
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await shot('my-colours-result');
  await page.evaluate(() => document.querySelector('.main')?.scrollTo(0, 100000));
  await shot('my-colours-result-lower');

  await ctx.close();
}
await browser.close();
console.log(`${count} screenshots written to ${out}`);
