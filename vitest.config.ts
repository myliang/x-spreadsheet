import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const sharedExcludes = [
  'legacy/**',
  'dist/**',
  'coverage/**',
  'node_modules/**',
  'playwright-report/**',
  'test-results/**',
  'tests/**/*.check.*',
  'tests/browser/**',
  'tests/visual/**',
];

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: sharedExcludes,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          exclude: sharedExcludes,
          include: ['tests/unit/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'component',
          environment: 'jsdom',
          exclude: sharedExcludes,
          include: ['tests/component/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ssr',
          environment: 'node',
          exclude: sharedExcludes,
          include: ['tests/ssr/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
