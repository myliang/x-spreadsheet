import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { parityManifest } from './manifest.ts';
import type { ParityEvidenceRecord, ParityLane } from './manifest-types.ts';

const lanes = ['unit', 'component', 'browser', 'visual'] as const;

function completeEvidence(): Array<Omit<ParityEvidenceRecord, 'runId' | 'revision' | 'treeHash' | 'manifestHash' | 'runner' | 'configHash' | 'startedAt' | 'observedAt'>> {
  return parityManifest.flatMap(row => lanes.flatMap((lane: ParityLane) => {
    const declaration = row[lane];
    return 'assertions' in declaration
      ? declaration.assertions.map(id => ({
        lane,
        status: 'passed' as const,
        title: `@parity:${id} release evidence`,
        source: `tests/${lane}/${id}.test.ts`,
      }))
      : [];
  }));
}

function runGate(path: string) {
  return spawnSync(process.execPath, ['scripts/test-parity-gate.mjs', path], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

test('release parity gate rejects synthetic evidence without a release context', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tego-sheet-parity-runner-'));
  try {
    const complete = completeEvidence();
    const completePath = join(directory, 'complete.ndjson');
    const missingPath = join(directory, 'missing.ndjson');
    const failedPath = join(directory, 'failed.ndjson');
    writeFileSync(completePath, complete.map(record => JSON.stringify(record)).join('\n'));
    writeFileSync(missingPath, complete.slice(1).map(record => JSON.stringify(record)).join('\n'));
    writeFileSync(failedPath, [
      JSON.stringify({ ...complete[0], status: 'failed' }),
      ...complete.slice(1).map(record => JSON.stringify(record)),
    ].join('\n'));

    const accepted = runGate(completePath);
    expect(accepted.status).not.toBe(0);
    expect(`${accepted.stdout}\n${accepted.stderr}`).toMatch(/release context|runId/i);

    const missing = runGate(missingPath);
    expect(missing.status).not.toBe(0);
    expect(`${missing.stdout}\n${missing.stderr}`).toMatch(/release context|runId/i);

    const failed = runGate(failedPath);
    expect(failed.status).not.toBe(0);
    expect(`${failed.stdout}\n${failed.stderr}`).toMatch(/release context|runId/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
