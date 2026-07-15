import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { resolveNpmInvocation, runNpm } from '../../scripts/package-test-runtime.mjs';

const repositoryRoot = new URL('../../', import.meta.url);
const repositoryPath = fileURLToPath(repositoryRoot);

test('demo TypeScript resolves every public locale from source without dist', () => {
  const config = JSON.parse(readFileSync(new URL('demo/tsconfig.json', repositoryRoot), 'utf8'));
  assert.deepEqual(config.compilerOptions.paths, {
    'tego-sheet': ['../src/index.ts'],
    'tego-sheet/styles.css': ['../src/ui/styles/index.less'],
    'tego-sheet/locales/en': ['../src/locales/en.ts'],
    'tego-sheet/locales/de': ['../src/locales/de.ts'],
    'tego-sheet/locales/nl': ['../src/locales/nl.ts'],
    'tego-sheet/locales/zh-cn': ['../src/locales/zh-cn.ts'],
  });
});

test('package and SSR orchestration is plain JavaScript for Node 20', () => {
  const packageJson = JSON.parse(readFileSync(new URL('package.json', repositoryRoot), 'utf8'));
  assert.equal(packageJson.scripts['test:package'], 'node scripts/test-package.mjs');
  assert.equal(packageJson.scripts['test:ssr'], 'node scripts/test-ssr.mjs');

  const paths = [
    'scripts/package-test-runtime.mjs',
    'scripts/test-package.mjs',
    'scripts/test-ssr.mjs',
    'tests/package/package-exports.test.mjs',
    'tests/package/package-metadata.check.mjs',
    'tests/package/packed-consumer.test.mjs',
    'tests/package/quality-gates.test.mjs',
    'tests/package/fixtures/node-esm/index.mjs',
    'tests/package/fixtures/node-cjs/index.cjs',
    'tests/ssr/public-entrypoints.test.mjs',
  ];
  for (const path of paths) {
    assert.equal(existsSync(new URL(path, repositoryRoot)), true, `${path} must exist`);
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL(path, repositoryRoot))]);
  }
});

test('npm commands prefer the active npm CLI and have shell-safe platform fallbacks', () => {
  assert.deepEqual(resolveNpmInvocation({
    env: { npm_execpath: '/tools/npm-cli.js' },
    execPath: '/tools/node',
    pathExists: () => false,
    platform: 'win32',
  }), { command: '/tools/node', args: ['/tools/npm-cli.js'] });

  assert.deepEqual(resolveNpmInvocation({
    env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    execPath: 'C:\\node\\node.exe',
    pathExists: () => false,
    platform: 'win32',
  }), {
    command: 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d', '/s', '/c', 'npm'],
  });

  assert.deepEqual(resolveNpmInvocation({
    env: {},
    execPath: '/usr/bin/node',
    pathExists: () => false,
    platform: 'linux',
  }), { command: 'npm', args: [] });
});

test('packed declaration probes cover NodeNext ESM and CommonJS', () => {
  for (const path of [
    'tests/package/fixtures/types/index.mts',
    'tests/package/fixtures/types/index.cts',
    'tests/package/fixtures/types/tsconfig.json',
  ]) assert.equal(existsSync(new URL(path, repositoryRoot)), true, `${path} must exist`);
});

test('a tracked-source copy builds the demo without library dist output', () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'tego-sheet-clean-demo-'));
  try {
    const files = execFileSync('git', ['ls-files', '-z'], {
      cwd: repositoryPath,
      encoding: 'utf8',
    }).split('\0').filter(path => (
      path === 'package.json'
      || path === 'tsconfig.json'
      || path.startsWith('demo/')
      || path.startsWith('src/')
    ));
    for (const path of files) {
      const target = join(temporaryRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(repositoryPath, path), target);
    }
    symlinkSync(join(repositoryPath, 'node_modules'), join(temporaryRoot, 'node_modules'), 'junction');
    assert.equal(existsSync(join(temporaryRoot, 'dist')), false);
    runNpm(['run', 'build:demo'], temporaryRoot);
    assert.equal(existsSync(join(temporaryRoot, 'demo-dist/index.html')), true);
    assert.equal(existsSync(join(temporaryRoot, 'dist')), false);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
