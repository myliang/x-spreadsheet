import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  exports: 'writable',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      '.nyc_output/**',
      '.worktrees/**',
      'coverage/**',
      'dist/**',
      'docs/**',
      'legacy/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: nodeGlobals,
      sourceType: 'module',
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    ...reactHooks.configs.flat.recommended,
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
  },
  {
    ...reactRefresh.configs.vite,
    files: ['src/**/*.tsx'],
  },
);
