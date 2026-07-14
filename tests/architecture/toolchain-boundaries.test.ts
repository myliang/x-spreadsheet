import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import viteConfig from '../../vite.config';

it('externalizes every React and React DOM runtime subpath', () => {
  const external = viteConfig.build?.rollupOptions?.external;

  expect(external).toBeTypeOf('function');
  if (typeof external !== 'function') {
    throw new TypeError('Vite must use a React external predicate');
  }

  for (const id of [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom',
    'react-dom/client',
    'react-dom/server',
  ]) {
    expect(external(id, undefined, false), id).toBe(true);
  }

  for (const id of ['reactive', 'react-domestic', '@scope/react']) {
    expect(external(id, undefined, false), id).toBe(false);
  }
});

it('keeps the core contract independent of React and browser globals', () => {
  const coreFiles = [
    'src/core/index.ts',
    'src/core/types/json.ts',
    'src/core/types/workbook.ts',
    'src/core/types/coordinates.ts',
    'src/core/types/changes.ts',
    'src/core/types/validation.ts',
    'src/core/types/options.ts',
    'src/core/errors/tego-sheet-error.ts',
    'src/core/errors/tego-sheet-exception.ts',
  ];

  for (const file of coreFiles) {
    const source = readFileSync(resolve(import.meta.dirname, '../..', file), 'utf8');

    expect(source, file).not.toMatch(/from\s+['"]react(?:\/[^'"]*)?['"]/);
    expect(source, file).not.toMatch(/\b(?:window|document|navigator)\b/);
  }
});
