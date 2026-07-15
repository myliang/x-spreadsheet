import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertParityReleaseContextCurrent,
  createParityReleaseContext,
} from '../../scripts/parity-release-provenance.mjs';

function write(root: string, path: string, contents: string): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
}

function releaseRepository(): string {
  const root = mkdtempSync(join(tmpdir(), 'tego-parity-provenance-'));
  write(root, 'package.json', JSON.stringify({
    devDependencies: { '@playwright/test': '1.61.1', vitest: '4.1.10' },
  }));
  for (const path of [
    'vitest.config.ts',
    'playwright.config.ts',
    'playwright.visual.config.ts',
    'tests/parity/manifest.ts',
  ]) write(root, path, `${path}\n`);
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'parity@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Parity Test'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: root });
  return root;
}

describe('parity release provenance', () => {
  it('rejects a synthetic non-UUID run identity even when every repository hash matches', () => {
    const root = releaseRepository();
    const now = new Date('2026-07-16T00:00:00.000Z');
    try {
      const context = createParityReleaseContext(root, now);
      expect(() => assertParityReleaseContextCurrent(
        { ...context, runId: 'synthetic-release' },
        root,
        now,
      )).toThrow(/run ID.*UUID/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
