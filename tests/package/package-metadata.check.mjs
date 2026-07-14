import assert from 'node:assert/strict';
import test from 'node:test';
import pkg from '../../package.json' with { type: 'json' };

const expectedDevDependencies = {
  '@eslint/js': '10.0.1',
  '@playwright/test': '1.61.1',
  '@testing-library/dom': '10.4.1',
  '@testing-library/react': '16.3.2',
  '@testing-library/user-event': '14.6.1',
  '@types/node': '24.13.3',
  '@types/react': '19.2.17',
  '@types/react-dom': '19.2.3',
  '@vitejs/plugin-react': '6.0.3',
  '@vitest/coverage-v8': '4.1.10',
  eslint: '10.7.0',
  'eslint-plugin-react-hooks': '7.1.1',
  'eslint-plugin-react-refresh': '0.5.3',
  jsdom: '29.1.1',
  less: '4.6.7',
  react: '19.2.7',
  'react-dom': '19.2.7',
  typescript: '6.0.3',
  'typescript-eslint': '8.64.0',
  vite: '8.1.4',
  'vite-plugin-dts': '5.0.3',
  vitest: '4.1.10',
};

const requiredScripts = [
  'test',
  'test:unit',
  'test:browser',
  'test:visual',
  'test:ssr',
  'test:package',
  'test:parity-gate',
  'typecheck',
  'lint',
  'dev',
  'build',
];

test('publishes only tego-sheet', () => {
  assert.equal(pkg.name, 'tego-sheet');
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.sideEffects, ['**/*.css']);
  assert.deepEqual(pkg.dependencies, {});
  assert.deepEqual(pkg.devDependencies, expectedDevDependencies);
  assert.deepEqual(pkg.peerDependencies, { react: '^19.2.7', 'react-dom': '^19.2.7' });
  assert.deepEqual(pkg.files, ['dist']);
  assert.deepEqual(pkg.exports, {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/tego-sheet.js',
      require: './dist/tego-sheet.cjs',
    },
  });
  assert.equal(Object.keys(pkg.exports).some((path) => path.includes('legacy')), false);
  assert.deepEqual(requiredScripts.filter((script) => !(script in pkg.scripts)), []);
  assert.equal('postinstall' in pkg.scripts, false);
  assert.equal('collective' in pkg, false);
  assert.equal('nyc' in pkg, false);
});
