import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

function run(command, args, cwd, env = process.env, stdio = ['ignore', 'pipe', 'pipe']) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', env, stdio });
}

export function resolveNpmInvocation({
  env = process.env,
  execPath = process.execPath,
  pathExists = existsSync,
  platform = process.platform,
} = {}) {
  if (typeof env.npm_execpath === 'string' && env.npm_execpath.length > 0) {
    return { command: execPath, args: [env.npm_execpath] };
  }

  const executableDirectory = dirname(execPath);
  const candidates = [
    resolve(executableDirectory, 'node_modules/npm/bin/npm-cli.js'),
    resolve(executableDirectory, '../lib/node_modules/npm/bin/npm-cli.js'),
    resolve(executableDirectory, '../node_modules/npm/bin/npm-cli.js'),
    ...(typeof env.APPDATA === 'string'
      ? [resolve(env.APPDATA, 'npm/node_modules/npm/bin/npm-cli.js')]
      : []),
  ];
  const npmCli = candidates.find(pathExists);
  if (npmCli !== undefined) return { command: execPath, args: [npmCli] };

  if (platform === 'win32') {
    return { command: env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'npm'] };
  }
  return { command: 'npm', args: [] };
}

export function runNpm(args, cwd, { env = process.env, stdio } = {}) {
  const invocation = resolveNpmInvocation({ env });
  return run(
    invocation.command,
    [...invocation.args, ...args],
    cwd,
    env,
    stdio ?? ['ignore', 'pipe', 'pipe'],
  );
}

export function buildAndInstallPackedConsumer(repositoryRoot) {
  runNpm(['run', 'build'], repositoryRoot);
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'tego-sheet-packed-'));

  try {
    const pack = JSON.parse(runNpm(
      ['pack', '--json', '--pack-destination', temporaryRoot],
      repositoryRoot,
    ));
    const tarball = join(temporaryRoot, pack[0].filename);
    const consumer = join(temporaryRoot, 'consumer');
    cpSync(resolve(repositoryRoot, 'fixtures/consumer'), consumer, { recursive: true });
    runNpm(['ci', '--ignore-scripts'], consumer);
    runNpm(['install', '--ignore-scripts', '--no-save', tarball], consumer);

    const installed = JSON.parse(readFileSync(
      join(consumer, 'node_modules/tego-sheet/package.json'),
      'utf8',
    ));
    assert.equal(installed.name, 'tego-sheet');

    return {
      directory: consumer,
      tarball,
      packFiles: pack[0].files.map(file => file.path),
      cleanup: () => rmSync(temporaryRoot, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

export function runNodeTests(repositoryRoot, tests, consumer) {
  execFileSync(process.execPath, ['--test', ...tests], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      TEGO_SHEET_CONSUMER: consumer.directory,
      TEGO_SHEET_PACK_FILES: JSON.stringify(consumer.packFiles),
      TEGO_SHEET_TARBALL: consumer.tarball,
    },
    stdio: 'inherit',
  });
}
