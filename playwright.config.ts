import { defineConfig } from '@playwright/test';
import { browserProjects } from './scripts/parity-release-contract.mjs';

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: 'test-results/playwright',
  projects: [...browserProjects],
  reporter: [
    ['list'],
    [
      './scripts/reporters/playwright-parity-evidence.ts',
      { lane: 'browser', outputPath: 'test-results/parity/browser.ndjson' },
    ],
  ],
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
  webServer: {
    command: 'pnpm exec vite --config tests/browser/harness/vite.config.ts',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  workers: 1,
});
