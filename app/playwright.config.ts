import { defineConfig } from '@playwright/test';

// Phone-sized screen (Pixel 8 portrait is about 412 x 915). Tests run against the built app.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4199', viewport: { width: 412, height: 915 }, hasTouch: true },
  webServer: {
    command: 'npm run build && vite preview --port 4199 --strictPort',
    url: 'http://localhost:4199',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
