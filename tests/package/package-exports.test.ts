import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const consumer = process.env.TEGO_SHEET_CONSUMER;
assert.ok(consumer, 'TEGO_SHEET_CONSUMER must point at the clean installed fixture');
const expectedExports = [
  '.',
  './styles.css',
  './locales/en',
  './locales/de',
  './locales/nl',
  './locales/zh-cn',
  './package.json',
];

test('the package exposes only the approved React surface', () => {
  const packageJson = JSON.parse(readFileSync(
    join(consumer, 'node_modules/tego-sheet/package.json'),
    'utf8',
  )) as {
    exports: Record<string, unknown>;
  };

  assert.deepEqual(Object.keys(packageJson.exports), expectedExports);
  assert.equal(packageJson.exports['./locales'], undefined);
});

test('the built root has only the approved runtime exports and internal subpaths are blocked', () => {
  execFileSync(process.execPath, ['--input-type=module', '--eval', `
      const root = await import('tego-sheet');
      if (JSON.stringify(Object.keys(root)) !== JSON.stringify(['TegoSheet', 'TegoSheetException'])) {
        throw new Error('Unexpected root exports: ' + Object.keys(root).join(','));
      }
      const exception = new root.TegoSheetException({
        code: 'INVALID_COMMAND', message: 'probe', recoverable: false,
      });
      if (!(exception instanceof root.TegoSheetException)) throw new Error('bad exception runtime');
    `], { cwd: consumer, stdio: 'pipe' });

  for (const subpath of [
    'tego-sheet/locales',
    'tego-sheet/core',
    'tego-sheet/engine',
    'tego-sheet/react/tego-sheet',
    'tego-sheet/src/index',
    'tego-sheet/legacy',
  ]) {
    const result = spawnSync(process.execPath, [
      '--input-type=module',
      '--eval',
      `await import(${JSON.stringify(subpath)})`,
    ], { cwd: consumer, encoding: 'utf8' });
    assert.notEqual(result.status, 0, `${subpath} unexpectedly resolved`);
    assert.match(result.stderr, /ERR_PACKAGE_PATH_NOT_EXPORTED/);
  }
});

test('each locale entry exports only its intended dictionary', () => {
  const probes = [
    ['en', 'en', 'en'],
    ['de', 'de', 'de'],
    ['nl', 'nl', 'nl'],
    ['zh-cn', 'zhCN', 'zh-CN'],
  ];

  for (const [subpath, name, id] of probes) {
    execFileSync(process.execPath, ['--input-type=module', '--eval', `
      const locale = await import(${JSON.stringify(`tego-sheet/locales/${subpath}`)});
      if (JSON.stringify(Object.keys(locale)) !== JSON.stringify([${JSON.stringify(name)}])) {
        throw new Error('Unexpected locale exports: ' + Object.keys(locale).join(','));
      }
      if (locale[${JSON.stringify(name)}].id !== ${JSON.stringify(id)}) throw new Error('bad id');
    `], { cwd: consumer, stdio: 'pipe' });
  }
});
