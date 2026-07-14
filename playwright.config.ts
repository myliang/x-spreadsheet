import { defineConfig } from '@playwright/test';

const desktop = { height: 720, width: 1280 };
const touch = { height: 844, width: 390 };

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: 'test-results/playwright',
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: desktop } },
    { name: 'firefox-desktop', use: { browserName: 'firefox', viewport: desktop } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: desktop } },
    {
      name: 'chromium-touch',
      use: { browserName: 'chromium', hasTouch: true, viewport: touch },
    },
    {
      name: 'firefox-touch',
      use: { browserName: 'firefox', hasTouch: true, viewport: touch },
    },
    {
      name: 'webkit-touch',
      use: { browserName: 'webkit', hasTouch: true, viewport: touch },
    },
  ],
  reporter: [['list']],
  retries: 0,
  testDir: './tests',
  testMatch: ['browser/**/*.spec.{ts,tsx}', 'visual/**/*.spec.{ts,tsx}'],
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  workers: 1,
});
