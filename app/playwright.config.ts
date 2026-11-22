import { defineConfig } from '@playwright/test';

// Phone-sized screen (Pixel 8 portrait is about 412 x 915). Tests run against the built app.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000, // the private pack is slow to load while other tests run
  expect: { timeout: 15_000 }, // the avatar pack can take over 5 s to load when tests run side by side
  workers: 2, // more workers starve the phone-sized tests of CPU and cause timeouts (V4-01)
  use: { baseURL: 'http://localhost:4199', viewport: { width: 412, height: 915 }, hasTouch: true },
  webServer: {
    command: 'npm run build && vite preview --port 4199 --strictPort',
    url: 'http://localhost:4199',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
