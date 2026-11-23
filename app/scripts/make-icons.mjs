// Renders public/icon.svg in headless Chromium and writes the app icons (192, 512 and the 180 px Apple touch icon).
// It also measures the maskable safe zone: the artwork without the tile must stay within 0.40 of the size from the centre.
// Run: npm run icons
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const svg = readFileSync(here('../public/icon.svg'), 'utf8');
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };
const SAFE_LIMIT = 0.4;
const uri = (s) => `data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [file, size] of Object.entries(SIZES)) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0"><img src="${uri(svg)}" width="${size}" height="${size}" style="display:block"></body>`);
    await page.waitForFunction(() => document.images[0].complete);
    writeFileSync(here(`../public/${file}`), await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } }));
    console.log(`wrote public/${file} (${size} px)`);
  }

  // Safe zone: draw the artwork without the tile and find the opaque pixel farthest from the centre.
  const bare = svg.replace(/<rect [^>]*\/>/, '');
  const frac = await page.evaluate(async ({ src, n }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, n, n);
    const d = ctx.getImageData(0, 0, n, n).data;
    let far = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (d[(y * n + x) * 4 + 3] > 127) far = Math.max(far, Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2));
    }
    return far / n;
  }, { src: uri(bare), n: 512 });
  console.log(`safe zone: farthest opaque pixel at ${frac.toFixed(3)} of the size (limit ${SAFE_LIMIT})`);
  if (frac > SAFE_LIMIT) {
    console.error('Artwork is outside the maskable safe zone.');
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
