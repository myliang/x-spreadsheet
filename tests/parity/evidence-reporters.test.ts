import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateParityEvidence,
  clearEvidenceArtifact,
  writeEvidenceArtifactAtomically,
  type EvidenceFileSystem,
  type ObservedParityResult,
} from '../../scripts/reporters/parity-evidence.ts';

function observed(overrides: Partial<ObservedParityResult> = {}): ObservedParityResult {
  return {
    lane: 'browser',
    project: 'chromium-touch',
    source: 'tests/browser/input-touch.spec.ts',
    status: 'passed',
    title: '@parity:input.touch-gestures exercises touch input',
    ...overrides,
  };
}

describe('parity evidence aggregation', () => {
  it('retains each project outcome instead of letting a pass hide project skips', () => {
    expect(aggregateParityEvidence([
      observed({ project: 'chromium-desktop', status: 'skipped' }),
      observed({ project: 'firefox-desktop', status: 'skipped' }),
      observed({ project: 'chromium-touch', status: 'passed' }),
    ])).toEqual([
      expect.objectContaining({ project: 'chromium-desktop', status: 'skipped' }),
      expect.objectContaining({ project: 'chromium-touch', status: 'passed' }),
      expect.objectContaining({ project: 'firefox-desktop', status: 'skipped' }),
    ]);
  });

  it('retains a failure even when another project or retry passes', () => {
    expect(aggregateParityEvidence([
      observed({ project: 'chromium', status: 'passed' }),
      observed({ project: 'firefox', status: 'failed' }),
      observed({ project: 'webkit', status: 'skipped' }),
    ])).toEqual([
      expect.objectContaining({ project: 'chromium', status: 'passed' }),
      expect.objectContaining({ project: 'firefox', status: 'failed' }),
      expect.objectContaining({ project: 'webkit', status: 'skipped' }),
    ]);
  });

  it('reports skipped only when every observed execution skipped', () => {
    expect(aggregateParityEvidence([
      observed({ project: 'chromium', status: 'skipped' }),
      observed({ project: 'webkit', status: 'skipped' }),
    ])).toEqual([
      expect.objectContaining({ project: 'chromium', status: 'skipped' }),
      expect.objectContaining({ project: 'webkit', status: 'skipped' }),
    ]);
  });

  it('aggregates duplicate assertion ids across titles and sources without hiding either trace', () => {
    expect(aggregateParityEvidence([
      observed({ source: 'tests/browser/a.spec.ts', title: '@parity:input.touch-gestures first' }),
      observed({ source: 'tests/browser/b.spec.ts', title: '@parity:input.touch-gestures second' }),
    ])).toEqual([expect.objectContaining({
      lane: 'browser',
      project: 'chromium-touch',
      source: 'tests/browser/a.spec.ts, tests/browser/b.spec.ts',
      status: 'passed',
      title: '@parity:input.touch-gestures first',
    })]);
  });

  it('retains unknown and malformed parity titles so the manifest gate can reject them', () => {
    const evidence = aggregateParityEvidence([
      observed({ title: '@parity:unknown.assertion actual test' }),
      observed({ source: 'tests/browser/malformed.spec.ts', title: '@parity:not_valid actual test' }),
      observed({ source: 'tests/browser/plain.spec.ts', title: 'ordinary test' }),
    ]);

    expect(evidence.map(record => record.title).sort()).toEqual([
      '@parity:not_valid actual test',
      '@parity:unknown.assertion actual test',
    ]);
  });
});

describe('parity evidence artifacts', () => {
  it('removes stale final and temporary evidence at run start', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-parity-clear-'));
    const artifact = join(directory, 'browser.ndjson');
    try {
      writeFileSync(artifact, 'stale');
      writeFileSync(join(directory, '.browser.ndjson.123.tmp'), 'interrupted');
      writeFileSync(join(directory, 'other.ndjson'), 'keep');

      clearEvidenceArtifact(artifact);

      expect(() => readFileSync(artifact, 'utf8')).toThrow();
      expect(() => readFileSync(join(directory, '.browser.ndjson.123.tmp'), 'utf8')).toThrow();
      expect(readFileSync(join(directory, 'other.ndjson'), 'utf8')).toBe('keep');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('publishes complete NDJSON through a same-directory atomic rename', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-parity-write-'));
    const artifact = join(directory, 'unit.ndjson');
    try {
      writeEvidenceArtifactAtomically(artifact, aggregateParityEvidence([
        observed({ lane: 'unit', project: 'unit' }),
      ]));

      expect(JSON.parse(readFileSync(artifact, 'utf8'))).toEqual(expect.objectContaining({
        lane: 'unit',
        project: 'unit',
        source: 'tests/browser/input-touch.spec.ts',
        status: 'passed',
        title: '@parity:input.touch-gestures exercises touch input',
      }));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not replace prior evidence and cleans its temporary file when publication fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-parity-error-'));
    const artifact = join(directory, 'component.ndjson');
    writeFileSync(artifact, 'prior');
    const realRename = vi.fn(() => {
      throw new Error('rename denied');
    });
    const fileSystem: EvidenceFileSystem = {
      mkdirSync: vi.fn(),
      readdirSync: vi.fn(() => []),
      renameSync: realRename,
      rmSync: vi.fn(),
      writeFileSync: vi.fn(),
    };
    try {
      expect(() => writeEvidenceArtifactAtomically(
        artifact,
        aggregateParityEvidence([observed()]),
        fileSystem,
      ))
        .toThrow(/rename denied/);
      expect(fileSystem.writeFileSync).toHaveBeenCalledOnce();
      expect(realRename).toHaveBeenCalledOnce();
      expect(fileSystem.rmSync).toHaveBeenCalledWith(
        expect.stringMatching(/\.component\.ndjson\..+\.tmp$/),
        { force: true },
      );
      expect(readFileSync(artifact, 'utf8')).toBe('prior');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
