import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';
import pkg from '../../package.json' with { type: 'json' };

const packageRoot = new URL('../../', import.meta.url);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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
  assert.equal(
    pkg.scripts['test:unit'],
    'vitest run --project unit --project component --project architecture',
  );
  assert.equal(
    pkg.scripts['test:package'],
    'npm run build && node --test tests/package/*.check.mjs',
  );
  assert.equal('postinstall' in pkg.scripts, false);
  assert.equal('collective' in pkg, false);
  assert.equal('nyc' in pkg, false);
});

test('published README describes only the current tego-sheet foundation', () => {
  const readme = readFileSync(new URL('readme.md', packageRoot), 'utf8');

  assert.doesNotMatch(
    readme,
    /x-data-spreadsheet|xspreadsheet|x_spreadsheet|new Spreadsheet|dist\/xspreadsheet|docs\/demo\.png/i,
  );
  assert.match(readme, /^# tego-sheet$/m);
  assert.match(readme, /React/);
  assert.match(readme, /TypeScript/);
  assert.match(readme, /active rewrite|not release-ready/i);
});

test('CI runs only the supported foundation checks on Node 24', () => {
  const travis = readFileSync(new URL('.travis.yml', packageRoot), 'utf8');

  assert.doesNotMatch(travis, /10\.12\.0|istanbul|coverage|npm install(?:\s|$)/i);
  assert.match(travis, /node_js:\s*\n\s*- ['"]?24['"]?/);
  assert.match(travis, /install:\s*\n\s*- npm ci/);

  const commands = [
    'npm run typecheck',
    'npm run lint',
    'npm test',
    'npm run build',
    'npm run test:package',
  ];
  const positions = commands.map((command) => travis.indexOf(command));
  assert.equal(positions.every((position) => position >= 0), true);
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
});

test('Vite development page describes the foundation without legacy runtime markers', () => {
  const html = readFileSync(new URL('index.html', packageRoot), 'utf8');

  assert.doesNotMatch(
    html,
    /x_spreadsheet|xspreadsheet|htmlWebpackPlugin|dist\/xspreadsheet|webpack/i,
  );
  assert.match(html, /tego-sheet/i);
  assert.match(html, /foundation|active rewrite|not release-ready/i);
});

test('lockfile uses the canonical npm registry', () => {
  const lockfile = readFileSync(new URL('package-lock.json', packageRoot), 'utf8');

  assert.doesNotMatch(lockfile, /registry\.npmmirror\.com/i);
  assert.match(lockfile, /https:\/\/registry\.npmjs\.org\//);
});

test('package dry run includes public files only', () => {
  const result = spawnSync(npmCommand, ['pack', '--dry-run', '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const [pack] = JSON.parse(result.stdout);
  const paths = pack.files.map(({ path }) => path);

  assert.deepEqual(paths, [
    'LICENSE',
    'dist/index.d.ts',
    'dist/tego-sheet.cjs',
    'dist/tego-sheet.js',
    'package.json',
    'readme.md',
  ]);

  const declaredTargets = new Set([
    pkg.main,
    pkg.module,
    pkg.types,
    ...Object.values(pkg.exports['.']),
  ]);
  for (const target of declaredTargets) {
    assert.equal(paths.includes(target.replace(/^\.\//, '')), true, target);
  }
});

test('built entry formats import without browser globals', () => {
  const clearBrowserGlobals = `
    for (const name of ['window', 'document', 'navigator']) {
      Reflect.deleteProperty(globalThis, name);
      if (name in globalThis) throw new Error(name + ' must be absent');
    }
  `;
  const esm = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `${clearBrowserGlobals}
       const entry = await import('./dist/tego-sheet.js');
       if (Object.getOwnPropertyNames(entry).length !== 0) {
         throw new Error('ESM entry exposes unexpected public exports');
       }`,
    ],
    { cwd: packageRoot, encoding: 'utf8' },
  );
  assert.equal(esm.status, 0, esm.stderr);

  const cjs = spawnSync(
    process.execPath,
    [
      '--eval',
      `${clearBrowserGlobals}
       const entry = require('./dist/tego-sheet.cjs');
       if (Object.getOwnPropertyNames(entry).length !== 0) {
         throw new Error('CJS entry exposes unexpected public exports');
       }`,
    ],
    { cwd: packageRoot, encoding: 'utf8' },
  );
  assert.equal(cjs.status, 0, cjs.stderr);
});
