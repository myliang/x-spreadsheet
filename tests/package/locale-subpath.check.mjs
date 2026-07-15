import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import test from 'node:test';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const expectedExports = ['de', 'en', 'nl', 'resolveLocale', 'zhCN'];

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test('packed consumers can import the React-safe locale subpath in ESM and CJS', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tego-sheet-locales-'));
  try {
    const packOutput = JSON.parse(run(
      npmCommand,
      ['pack', '--json', '--pack-destination', directory],
      packageRoot,
    ));
    const tarball = join(directory, packOutput[0].filename);
    writeFileSync(join(directory, 'package.json'), JSON.stringify({
      name: 'tego-sheet-locale-probe',
      private: true,
      type: 'module',
    }));
    run(
      npmCommand,
      ['install', '--ignore-scripts', '--legacy-peer-deps', '--no-package-lock', tarball],
      directory,
    );

    const esm = run(process.execPath, [
      '--input-type=module',
      '--eval',
      `const locale = await import('tego-sheet/locales');
       const expected = ${JSON.stringify(expectedExports)};
       const actual = Object.getOwnPropertyNames(locale);
       if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(actual.join(','));
       if (locale.en.id !== 'en' || locale.zhCN.id !== 'zh-CN') throw new Error('invalid locale ids');`,
    ], directory);
    assert.equal(esm, '');

    const cjsProbe = join(directory, 'probe.cjs');
    writeFileSync(cjsProbe, `
      const locale = require('tego-sheet/locales');
      const expected = ${JSON.stringify(expectedExports)};
      const actual = Object.getOwnPropertyNames(locale);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(actual.join(','));
      if (locale.de.id !== 'de' || locale.nl.id !== 'nl') throw new Error('invalid locale ids');
    `);
    run(process.execPath, [cjsProbe], directory);

    const typeProbe = join(directory, 'probe.ts');
    writeFileSync(typeProbe, `
      import { de, en, nl, resolveLocale, zhCN } from 'tego-sheet/locales';
      const ids: string[] = [de.id, en.id, nl.id, zhCN.id, resolveLocale().id];
      void ids;
    `);
    run(process.execPath, [
      join(packageRoot, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      typeProbe,
    ], directory);

    const installedPackage = JSON.parse(readFileSync(
      join(directory, 'node_modules/tego-sheet/package.json'),
      'utf8',
    ));
    assert.deepEqual(installedPackage.exports['./locales'], {
      types: './dist/locales/index.d.ts',
      import: './dist/locales/index.js',
      require: './dist/locales/index.cjs',
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
