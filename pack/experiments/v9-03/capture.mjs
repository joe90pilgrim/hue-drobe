// V9-03: renders the harness with Playwright. Usage (from the repo root):
//   node pack/experiments/v9-03/capture.mjs render <target> <pattern,pattern,...> [outDir]
//   node pack/experiments/v9-03/capture.mjs bench  <target> <pattern,pattern,...>
// Renders front (0), three-quarter (40) and back (180) per pattern into private/renders/v9-03/.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { start } from './serve.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = join(here, '..', '..', '..');
const { chromium } = createRequire(join(repo, 'app', 'package.json'))('@playwright/test');
const [mode, target = 'tee', patterns = 'hstripes', outArg] = process.argv.slice(2);
const out = outArg ?? join(repo, 'private', 'renders', 'v9-03');
mkdirSync(out, { recursive: true });

const srv = await start(4301);
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (const pattern of patterns.split(',')) {
    const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
    page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 400)); });
    const extra = process.env.EXTRA ?? '';
    await page.goto(`http://localhost:4301/index.html?target=${target}&pattern=${pattern}${extra}`);
    await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
    if (mode === 'render') {
      for (const [view, az] of [['front', 0], ['three-quarter', 40], ['back', 180]]) {
        await page.evaluate((a) => window.setView(a), az);
        await page.locator('canvas').screenshot({ path: join(out, `${target}_${pattern}_${view}.png`) });
      }
      console.log('rendered', target, pattern);
    } else {
      const stats = await page.evaluate(() => window.stats());
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await page.evaluate(() => window.bench(150)));
      console.log(JSON.stringify({ target, pattern, ...stats, ms_per_frame_runs: runs.map((r) => +r.toFixed(2)), glslBytes: await page.evaluate(() => window.glslBytes) }));
    }
    await page.close();
  }
} finally {
  await browser.close();
  srv.close();
}
