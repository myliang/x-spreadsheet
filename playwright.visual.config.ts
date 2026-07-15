import { defineConfig } from '@playwright/test';

const desktop = { height: 720, width: 1280 };
const touch = { height: 844, width: 390 };

export default defineConfig({
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
      threshold: 24 / 255,
    },
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: 'test-results/playwright-visual',
  projects: [
    { name: 'desktop-dpr1', use: { browserName: 'chromium', deviceScaleFactor: 1, viewport: desktop } },
    { name: 'desktop-dpr2', use: { browserName: 'chromium', deviceScaleFactor: 2, viewport: desktop } },
    {
      name: 'touch-dpr1',
      use: { browserName: 'chromium', deviceScaleFactor: 1, hasTouch: true, isMobile: true, viewport: touch },
    },
    {
      name: 'touch-dpr2',
      use: { browserName: 'chromium', deviceScaleFactor: 2, hasTouch: true, isMobile: true, viewport: touch },
    },
  ],
  reporter: [
    ['list'],
    [
      './scripts/reporters/playwright-parity-evidence.ts',
      { lane: 'visual', outputPath: 'test-results/parity/visual.ndjson' },
    ],
  ],
  retries: 0,
  snapshotPathTemplate: '{testDir}/__snapshots__/{arg}-{projectName}{ext}',
  testDir: './tests/visual',
  testMatch: ['visual.spec.ts'],
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --config tests/visual/harness/vite.config.ts',
    port: 4174,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  workers: 1,
});
