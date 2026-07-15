import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { URL } from 'node:url';
import { runNpm } from '../../scripts/package-test-runtime.mjs';

const consumer = process.env.TEGO_SHEET_CONSUMER;
assert.ok(consumer, 'TEGO_SHEET_CONSUMER must point at the clean installed fixture');

function run(command, args) {
  execFileSync(command, args, { cwd: consumer, stdio: 'inherit' });
}

test('the packed artifact typechecks and builds in a clean Vite consumer', () => {
  runNpm(['run', 'typecheck'], consumer, { stdio: 'inherit' });
  runNpm(['run', 'build'], consumer, { stdio: 'inherit' });
});

test('the packed declarations typecheck in NodeNext ESM and CommonJS consumers', () => {
  const fixture = new URL('./fixtures/types/', import.meta.url);
  cpSync(fixture, join(consumer, 'types'), { recursive: true });
  const tsc = join(consumer, 'node_modules/typescript/bin/tsc');
  run(process.execPath, [tsc, '--project', 'types/tsconfig.esm.json']);
  run(process.execPath, [tsc, '--project', 'types/tsconfig.cjs.json']);
});

test('the packed artifact works for ESM and CommonJS Node consumers', () => {
  const fixtureRoot = new URL('./fixtures/', import.meta.url);
  cpSync(new URL('node-esm/', fixtureRoot), join(consumer, 'node-esm'), { recursive: true });
  cpSync(new URL('node-cjs/', fixtureRoot), join(consumer, 'node-cjs'), { recursive: true });
  run(process.execPath, ['node-esm/index.mjs']);
  run(process.execPath, ['node-cjs/index.cjs']);
});

test('React stays peer-only and package files are publishable outputs', () => {
  const installedRoot = join(consumer, 'node_modules/tego-sheet');
  const installed = JSON.parse(readFileSync(join(installedRoot, 'package.json'), 'utf8'));
  assert.deepEqual(installed.dependencies, {});
  assert.deepEqual(installed.peerDependencies, {
    react: '^19.2.7',
    'react-dom': '^19.2.7',
  });
  assert.equal(lstatSync(installedRoot).isSymbolicLink(), false);
  assert.equal(realpathSync(installedRoot).startsWith(realpathSync(consumer)), true);

  const esmBundle = readFileSync(join(installedRoot, 'dist/tego-sheet.js'), 'utf8');
  assert.match(esmBundle, /from ["']react["']/);
  assert.match(esmBundle, /from ["']react\/jsx-runtime["']/);
  assert.doesNotMatch(esmBundle, /react\.production|react\.development/);

  const germanBundle = readFileSync(join(installedRoot, 'dist/locales/de.js'), 'utf8');
  assert.match(germanBundle, /Rückgängig/);
  assert.doesNotMatch(germanBundle, /Spreadsheet toolbar|电子表格工具栏|Werkbalk voor spreadsheets/);

  const files = JSON.parse(process.env.TEGO_SHEET_PACK_FILES ?? '[]');
  assert.equal(files.includes('dist/styles.css'), true);
  assert.equal(files.includes('dist/index.d.ts'), true);
  assert.equal(files.includes('package.json'), true);
  assert.equal(files.includes('readme.md'), true);
  assert.equal(files.includes('docs/migration-from-x-data-spreadsheet.md'), true);
  assert.equal(files.some(file => file.startsWith('src/') || file.startsWith('legacy/')), false);
});
