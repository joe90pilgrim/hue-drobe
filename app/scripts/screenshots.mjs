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
      const req = indexedDB.open('huedrobe-joe', 1);
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
  await page.locator('.wear-row[data-row="Top"]').waitFor();

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

  // --- V10-01 additions: Packing, the packing sheets, Add from photo and the back-up and restore states. ---
  // Same sample wardrobe as above. Server calls (/api/packing-template, /api/identify) are answered by routes in this script,
  // so the sheets show their loading, done and error states without a server or any real answer.
  const seedKv = (data) =>
    page.evaluate(async (d) => {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('huedrobe-joe', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => {
          const tx = req.result.transaction('kv', 'readwrite');
          for (const [key, value] of Object.entries(d)) tx.objectStore('kv').put(value, key);
          tx.oncomplete = () => { req.result.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, data);
  const line = (ref, label, extra = {}) => ({ kind: 'template', ref, packed: false, text: extra.quantity > 1 ? `${extra.quantity} × ${label}` : label, label, ...extra });
  const TRIPS = [
    {
      v: 1, id: 't1', name: 'Lisbon weekend', starts: '2026-12-14', ends: '2026-12-16', savedAt: 1,
      entries: [
        { kind: 'item', ref: 'i1', packed: false, via: ['o1'], own: true },
        { kind: 'item', ref: 'i3', packed: true, via: ['o1'] },
        { kind: 'item', ref: 'i4', packed: false, own: true },
        { kind: 'outfit', ref: 'o1', packed: false },
        line('l1', 'White T-shirt', { group: 'Tops', type: 'tee', colour: '#f4f4f2', matches: ['i2'] }),
        line('l2', 'Shorts', { group: 'Bottoms', type: 'shorts', colour: '#b8ad98', matches: ['i5'], quantity: 2 }),
        line('l3', 'Walking shoes', { group: 'Shoes', type: 'trainers', colour: '#f4f4f2' }),
        line('l4', 'Passport', { group: 'Documents' }),
        line('l5', 'Sweatshirt', { group: 'Layers', type: 'sweatshirt', colour: '#8c8c8c', matchedTo: ['i4'], packed: false }),
      ],
    },
    { v: 1, id: 't2', name: 'Cardiff day trip', starts: '2026-12-20', ends: '2026-12-20', savedAt: 2, entries: [] },
  ];
  const pressEsc = async () => {
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      if (!(await page.locator('dialog[open]').count())) break;
    }
  };

  // Packing: no trips, the new-trip form, then two trips.
  await go('packing');
  await shot('packing-empty');
  await page.getByRole('button', { name: 'New trip' }).click();
  await shot('packing-new-trip-form');
  await pressEsc();
  await seedKv({ trips: TRIPS });
  await go('packing');
  await shot('packing-trips');
  await page.locator('.p-trip').first().click();
  await shot('packing-trip-tray');
  await page.evaluate(() => document.querySelector('.main')?.scrollTo(0, 100000));
  await shot('packing-trip-tray-lower');
  await page.locator('.p-packed-btn').click();
  await shot('packing-trip-packed-open');
  await page.locator('.p-trip').nth(1).click();
  await shot('packing-trip-empty');
  await page.locator('.p-trip').first().click();
  await page.locator('[data-act="edit"]').click();
  await shot('packing-edit-trip');
  await pressEsc();

  // The Add sheet: clothes, outfits and an empty search.
  await page.locator('[data-act="add"]').click();
  await shot('packing-add-sheet');
  await page.getByRole('tab', { name: /^Outfits/ }).click();
  await shot('packing-add-sheet-outfits');
  await page.getByLabel('Search').fill('zzz');
  await shot('packing-add-sheet-no-match');
  await pressEsc();

  // The Match sheet and the Review sheet, from the suggested lines in the trip.
  await page.locator('[data-act="match-line"]:not([disabled])').first().click();
  await shot('packing-match-sheet');
  await page.locator('[data-match-scope="all"]').click();
  await shot('packing-match-sheet-all-clothes');
  await pressEsc();
  await page.locator('[data-act="review-matches"]').first().click();
  await shot('packing-review-sheet');
  await pressEsc();

  // The Suggest sheet: ask, error, then loading and done. The server's answer is made up here.
  await page.route('**/api/packing-template', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await page.locator('[data-act="make-template"]').click();
  await shot('packing-suggest-confirm');
  await page.locator('[data-act="suggest-ask"]').click();
  await shot('packing-suggest-error');
  await pressEsc();
  await page.unroute('**/api/packing-template');
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/packing-template', async (r) => {
    await held;
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ label: 'Light jacket', group: 'Layers', type: 'sweatshirt', colour: '#8c8c8c', matches: ['i4'] }, { label: 'Socks', quantity: 3, group: 'Tops' }, { label: 'Charger', group: 'Tech' }] }),
    });
  });
  await page.locator('[data-act="make-template"]').click();
  await page.locator('[data-act="suggest-ask"]').click();
  await shot('packing-suggest-loading');
  release();
  await page.locator('[data-act="suggest-done"]').waitFor();
  await shot('packing-suggest-done');
  await page.locator('[data-act="suggest-done"]').click();
  await page.waitForTimeout(200);
  await page.unroute('**/api/packing-template');

  // Add from photo: the Wardrobe buttons, the sheet while it reads, the form after a failed read, and the screenshot crop.
  await go('wardrobe');
  await shot('wardrobe-add-from-photo-buttons');
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 900;
    const g = c.getContext('2d');
    g.fillStyle = '#eeeeee';
    g.fillRect(0, 0, 600, 900);
    g.fillStyle = '#1f2a5a';
    g.fillRect(150, 250, 300, 380);
    return c.toDataURL('image/png').split(',')[1];
  });
  const file = { name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
  let releasePhoto;
  const heldPhoto = new Promise((resolve) => { releasePhoto = resolve; });
  await page.route('**/api/identify', async (r) => {
    await heldPhoto;
    await r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.locator('input[data-input="upload"]').setInputFiles(file);
  await page.locator('.w-addsheet[open]').waitFor();
  await shot('add-from-photo-reading');
  releasePhoto();
  await page.locator('.w-add-form:not([hidden])').waitFor();
  await shot('add-from-photo-form');
  await pressEsc();
  await page.unroute('**/api/identify');
  await page.locator('input[data-input="screenshot"]').setInputFiles(file);
  await page.locator('.w-crop:not([hidden])').waitFor();
  await shot('add-from-screenshot-crop');
  const stageBox = await page.locator('.w-crop-stage').boundingBox();
  if (stageBox) {
    await page.mouse.move(stageBox.x + stageBox.width * 0.25, stageBox.y + stageBox.height * 0.28);
    await page.mouse.down();
    await page.mouse.move(stageBox.x + stageBox.width * 0.75, stageBox.y + stageBox.height * 0.7, { steps: 5 });
    await page.mouse.up();
    await shot('add-from-screenshot-crop-box');
  }
  await pressEsc();

  // Back up and restore: saved, the replace question, and a file that is not a backup. Phone opens it from the menu, laptop from the sidebar.
  const openBackup = () => page.locator(size === 'phone' ? '#menu-btn' : '#backup-btn').click();
  await go('try-on');
  await openBackup();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#b-export').click()]);
  await shot('back-up-saved');
  const saved = await download.path();
  await page.locator('#b-file').setInputFiles(saved);
  await page.locator('#b-replace').waitFor({ state: 'visible' });
  await shot('restore-confirm');
  await page.locator('#b-cancel').click();
  await shot('restore-cancelled');
  await page.locator('#b-file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('not a backup') });
  await page.waitForTimeout(300);
  await shot('restore-not-a-backup');
  await pressEsc();

  await ctx.close();
}
await browser.close();
console.log(`${count} screenshots written to ${out}`);
