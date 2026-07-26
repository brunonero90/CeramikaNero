import { defineConfig } from '@playwright/test';

/**
 * Low-resource E2E: one worker, sequential, no screenshots/video/traces.
 * Screenshots crash this laptop — keep them off permanently.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    headless: true,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
