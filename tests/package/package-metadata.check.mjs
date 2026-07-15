import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import pkg from '../../package.json' with { type: 'json' };

const packageRoot = new URL('../../', import.meta.url);

test('metadata describes a peer-only React package with explicit exports', () => {
  assert.equal(pkg.name, 'tego-sheet');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.license, 'MIT');
  assert.deepEqual(pkg.dependencies, {});
  assert.deepEqual(pkg.peerDependencies, { react: '^19.2.7', 'react-dom': '^19.2.7' });
  assert.deepEqual(pkg.files, ['dist', 'docs/migration-from-x-data-spreadsheet.md']);
  assert.deepEqual(pkg.sideEffects, ['**/*.css']);
  assert.deepEqual(Object.keys(pkg.exports), [
    '.',
    './styles.css',
    './locales/en',
    './locales/de',
    './locales/nl',
    './locales/zh-cn',
    './package.json',
  ]);
  assert.equal(pkg.scripts['test:ssr'], 'node scripts/test-ssr.ts');
  assert.equal(pkg.scripts['test:package'], 'node scripts/test-package.ts');
  assert.equal('postinstall' in pkg.scripts, false);
});

test('published docs cover the complete React API and migration contract', () => {
  const readme = readFileSync(new URL('readme.md', packageRoot), 'utf8');
  const migration = readFileSync(
    new URL('docs/migration-from-x-data-spreadsheet.md', packageRoot),
    'utf8',
  );

  for (const term of [
    'controlled', 'uncontrolled', 'onChange', 'onCellEdit', 'TegoSheetHandle',
    'toolbar', 'sheetTabs', 'styles.css', 'locales/zh-cn',
  ]) assert.match(readme, new RegExp(term, 'i'));

  for (const term of [
    'empty workbook', 'all sheets', 'rendered value', 'resource cleanup',
    'printable', 'constructor', 'global', 'emitter',
  ]) assert.match(migration, new RegExp(term, 'i'));
});

test('packed files contain publishable outputs but no workspace source or dependencies', () => {
  const files = JSON.parse(process.env.TEGO_SHEET_PACK_FILES ?? '[]');
  for (const required of [
    'LICENSE', 'package.json', 'readme.md', 'dist/index.d.ts', 'dist/styles.css',
    'dist/tego-sheet.js', 'dist/tego-sheet.cjs',
    'dist/locales/en.js', 'dist/locales/en.cjs', 'dist/locales/en.d.ts',
    'dist/locales/de.js', 'dist/locales/nl.js', 'dist/locales/zh-cn.js',
  ]) assert.equal(files.includes(required), true, `${required} must be packed`);
  assert.equal(files.some(path => /^(?:src|legacy|tests|fixtures|node_modules)\//.test(path)), false);
});

test('repository lockfile cryptographically pins every registry package', () => {
  const lockfile = JSON.parse(readFileSync(new URL('package-lock.json', packageRoot), 'utf8'));
  const gaps = Object.entries(lockfile.packages).flatMap(([path, entry]) => {
    if (!path.startsWith('node_modules/') || entry.link || entry.inBundle) return [];
    if (typeof entry.resolved !== 'string' || !entry.resolved.startsWith('https://registry.npmjs.org/')) {
      return [`${path}: resolved`];
    }
    if (typeof entry.integrity !== 'string' || !/^sha(?:1|256|384|512)-/.test(entry.integrity)) {
      return [`${path}: integrity`];
    }
    return [];
  });
  assert.deepEqual(gaps, []);
});
