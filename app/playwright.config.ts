import { defineConfig } from '@playwright/test';

// Phone-sized screen (Pixel 8 portrait is about 412 x 915). Tests run against the built app.
// By default the preview server serves the placeholder pack in e2e/fixtures/pack/ (T-01), so no private data is needed.
// `npm run check:private` sets E2E_PRIVATE_PACK=1 to serve Joe's and B's real packs from private/pack/ instead.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 2, // more workers starve the phone-sized tests of CPU and cause timeouts (V4-01)
  use: {
    baseURL: 'http://localhost:4199',
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    serviceWorkers: 'block', // only offline.spec.ts needs one, and opts back in
    trace: 'retain-on-failure', // a failing test leaves a trace in test-results/ (open with npx playwright show-trace)
  },
  webServer: {
    // No separate typecheck here: `npm run check` has its own typecheck step.
    command: 'vite build && vite preview --port 4199 --strictPort',
    url: 'http://localhost:4199',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { E2E_PACK: process.env.E2E_PRIVATE_PACK ? 'private' : 'fixture' },
  },
});
