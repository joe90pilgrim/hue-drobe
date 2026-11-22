// V4-02 live check: how well does "Add from screenshot" match real retailer screenshots?
// For each screenshot in a manifest it drives the real app (file picker, crop box, "Use this part"), lets the app's own code shrink the
// crop, and sends it through the real server code (deploy/identify.mjs) to the real Gemini API. It then compares the answer with what
// Joe would pick: the template (right or wrong) and the colour difference (CIEDE2000) against Joe's colour. Numbers are reported, not forced
// to pass; Joe judges whether they are good enough.
//
// Usage (from app/):
//   node scripts/screenshot-check.mjs [manifest.json]      default: ../private/screenshot-check/manifest.json
// Needs the Gemini key in ../private/gemini-key.txt (or GEMINI_API_KEY) and Playwright's Chromium (`npx playwright install chromium`).
// The screenshots, manifest and results stay in private/ (git-ignored). Nothing is uploaded except the crops, to Gemini, as in the app.
//
// Manifest: a JSON list. `file` is relative to the manifest. `crop` is optional: [left, top, right, bottom] as fractions of the screenshot
// (default: the whole screenshot). `template` is the garment id Joe would pick (see app/src/wardrobe.ts), `variant` is optional (a tee's
// neckline or tights' "sheer"), `colour` is the hex Joe would pick. See screenshot-check.example.json.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { cleanRequest, createIdentifier } from '../../deploy/identify.mjs';
import { deltaEHex } from '../src/delta-e.ts';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const manifestPath = resolve(process.argv[2] ?? resolve(appDir, '../private/screenshot-check/manifest.json'));
if (!existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath}. Copy scripts/screenshot-check.example.json there and list the screenshots.`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const keyFile = resolve(appDir, '../private/gemini-key.txt');
const apiKey = process.env.GEMINI_API_KEY ?? (existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : '');
if (!apiKey) {
  console.error('No Gemini key: put it in private/gemini-key.txt or set GEMINI_API_KEY.');
  process.exit(1);
}
const identify = createIdentifier({ apiKey, model: process.env.GEMINI_MODEL || undefined });

// The app, served by Vite on its own port for the length of the run.
const PORT = 4198;
const vite = spawn(process.execPath, [resolve(appDir, 'node_modules/vite/bin/vite.js'), '--port', String(PORT), '--strictPort'], { cwd: appDir, stdio: 'ignore' });
const stop = () => vite.kill();
process.on('exit', stop);
const base = `http://localhost:${PORT}`;
for (let i = 0; ; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {}
  if (i > 60) {
    console.error('The app did not start.');
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
const rows = [];
for (const [n, entry] of manifest.entries()) {
  const file = resolve(dirname(manifestPath), entry.file);
  const [l, t, r, b] = entry.crop ?? [0.01, 0.01, 0.99, 0.99];
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true });
  const page = await context.newPage();
  let answer = null;
  let error = '';
  await page.route('**/api/identify', async (route) => {
    const clean = cleanRequest(route.request().postDataJSON());
    try {
      answer = await identify(clean);
      await route.fulfill({ json: answer });
    } catch (e) {
      error = e.message;
      await route.fulfill({ status: e.status ?? 502, body: e.message });
    }
  });
  try {
    await page.goto(`${base}/#/wardrobe`);
    await page.locator('input[data-input="screenshot"]').setInputFiles(file);
    const canvas = page.locator('.w-crop canvas');
    await canvas.waitFor();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * l, box.y + box.height * t);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * ((l + r) / 2), box.y + box.height * ((t + b) / 2), { steps: 5 });
    await page.mouse.move(box.x + box.width * r, box.y + box.height * b, { steps: 5 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Use this part' }).click();
    await page.locator('.w-add-form:not([hidden])').waitFor({ timeout: 60_000 });
  } catch (e) {
    error ||= e.message.split('\n')[0];
  }
  await context.close();

  const templateRight = !!answer && answer.templateId === entry.template && (entry.variant ? answer.variant === entry.variant : true);
  const dE = answer ? deltaEHex(answer.hexColor, entry.colour) : null;
  rows.push({ n: n + 1, file: entry.file, expected: entry.template + (entry.variant ? `/${entry.variant}` : ''), got: answer ? `${answer.templateId ?? 'no match'}${answer.variant ? `/${answer.variant}` : ''}` : `error: ${error}`, right: templateRight, confidence: answer?.confidence, joeColour: entry.colour, suggested: answer?.hexColor, dE });
}
await browser.close();
stop();

const fmt = (x, d = 1) => (typeof x === 'number' ? x.toFixed(d) : '-');
const lines = [
  `V4-02 live check, ${new Date().toISOString().slice(0, 10)}, ${rows.length} screenshots, model ${process.env.GEMINI_MODEL || 'default'}`,
  '',
  '| # | Screenshot | Joe\'s template | Suggested | Right? | Confidence | Joe\'s colour | Suggested colour | dE2000 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.n} | ${r.file} | ${r.expected} | ${r.got} | ${r.right ? 'right' : 'wrong'} | ${fmt(r.confidence, 2)} | ${r.joeColour} | ${r.suggested ?? '-'} | ${fmt(r.dE)} |`),
  '',
  `Template right: ${rows.filter((r) => r.right).length} of ${rows.length}`,
  `Colour dE2000: median ${fmt(median(rows.map((r) => r.dE).filter((x) => x !== null)))}, worst ${fmt(Math.max(...rows.map((r) => r.dE ?? 0)))}`,
  '(about 1 is barely visible, 2 to 3 visible when looking for it, above 5 plainly a different shade)',
];
function median(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
const out = lines.join('\n');
console.log(out);
const outFile = resolve(dirname(manifestPath), 'results.md');
writeFileSync(outFile, out + '\n');
console.log(`\nSaved to ${outFile}`);
