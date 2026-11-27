// V9-03: stitches the per-view renders into one contact sheet (rows = patterns, columns = front, three-quarter, back).
//   node pack/experiments/v9-03/sheet.mjs <target> <pattern,pattern,...> [sheetName] [scale]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const { chromium } = createRequire(join(repo, 'app', 'package.json'))('@playwright/test');
const [target, patterns, name = `${process.argv[2]}_sheet`, scaleArg = '0.5'] = process.argv.slice(2);
const dir = join(repo, 'private', 'renders', 'v9-03');
const scale = Number(scaleArg), views = ['front', 'three-quarter', 'back'];
const rows = patterns.split(',').map((p) => `<div style="display:flex;align-items:center"><b style="width:90px;font:14px sans-serif">${p}</b>${views.map((v) => `<img width="${600 * scale}" src="data:image/png;base64,${readFileSync(join(dir, `${target}_${p}_${v}.png`)).toString('base64')}">`).join('')}</div>`).join('');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 90 + 3 * 600 * scale, height: patterns.split(',').length * 800 * scale } });
await page.setContent(`<body style="margin:0;background:#e9e6e1">${rows}</body>`);
await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
await browser.close();
console.log(join(dir, `${name}.png`));
