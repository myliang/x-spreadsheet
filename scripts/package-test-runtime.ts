import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command: string, args: readonly string[], cwd: string, env = process.env): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export interface PackedConsumer {
  readonly directory: string;
  readonly tarball: string;
  readonly packFiles: readonly string[];
  cleanup(): void;
}

export function buildAndInstallPackedConsumer(repositoryRoot: string): PackedConsumer {
  run(npm, ['run', 'build'], repositoryRoot);
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'tego-sheet-packed-'));

  try {
    const pack = JSON.parse(run(
      npm,
      ['pack', '--json', '--pack-destination', temporaryRoot],
      repositoryRoot,
    )) as [{ filename: string; files: Array<{ path: string }> }];
    const tarball = join(temporaryRoot, pack[0].filename);
    const consumer = join(temporaryRoot, 'consumer');
    cpSync(resolve(repositoryRoot, 'fixtures/consumer'), consumer, { recursive: true });
    run(npm, ['ci', '--ignore-scripts'], consumer);
    run(npm, ['install', '--ignore-scripts', '--no-save', tarball], consumer);

    const installed = JSON.parse(readFileSync(
      join(consumer, 'node_modules/tego-sheet/package.json'),
      'utf8',
    )) as { name: string };
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

export function runNodeTests(
  repositoryRoot: string,
  tests: readonly string[],
  consumer: PackedConsumer,
): void {
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
