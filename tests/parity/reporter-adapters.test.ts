import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestCase as PlaywrightTestCase, TestResult as PlaywrightTestResult } from '@playwright/test/reporter';
import type { Reporter as VitestReporter } from 'vitest/reporters';
import { describe, expect, it, vi } from 'vitest';
import PlaywrightParityEvidenceReporter from '../../scripts/reporters/playwright-parity-evidence.ts';
import VitestParityEvidenceReporter from '../../scripts/reporters/vitest-parity-evidence.ts';
import type { ParityEvidenceRecord } from './manifest-types.ts';

type VitestTestCase = Parameters<NonNullable<VitestReporter['onTestCaseResult']>>[0];
type TestSpecification = Parameters<NonNullable<VitestReporter['onTestRunStart']>>[0][number];

function readEvidence(path: string): ParityEvidenceRecord[] {
  return readFileSync(path, 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line) as ParityEvidenceRecord);
}

function vitestSpecification(project: string): TestSpecification {
  return { project: { name: project } } as unknown as TestSpecification;
}

function vitestCase(
  root: string,
  project: 'unit' | 'component',
  status: 'passed' | 'failed' | 'skipped',
): VitestTestCase {
  return {
    fullName: '@parity:workbook.runner-adapter runs through Vitest',
    module: { moduleId: join(root, `tests/${project}/runner.test.ts`) },
    project: { name: project },
    result: () => ({ state: status }),
  } as unknown as VitestTestCase;
}

function playwrightCase(
  root: string,
  project: string,
  title = '@parity:input.runner-adapter runs through Playwright',
): PlaywrightTestCase {
  return {
    location: { column: 1, file: join(root, 'tests/browser/runner.spec.ts'), line: 1 },
    parent: { project: () => ({ name: project }) },
    title,
  } as unknown as PlaywrightTestCase;
}

function playwrightResult(status: PlaywrightTestResult['status']): PlaywrightTestResult {
  return { status } as PlaywrightTestResult;
}

describe('Vitest parity evidence reporter', () => {
  it('leaves retained release artifacts untouched during an ordinary development run', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-vitest-retained-release-'));
    const unit = join(directory, 'test-results/parity/unit.ndjson');
    const component = join(directory, 'test-results/parity/component.ndjson');
    mkdirSync(join(directory, 'test-results/parity'), { recursive: true });
    writeFileSync(unit, 'retained unit release');
    writeFileSync(component, 'retained component release');
    vi.stubEnv('TEGO_PARITY_RELEASE_CONTEXT', undefined);
    try {
      const reporter = new VitestParityEvidenceReporter({ releaseOnly: true, root: directory });
      reporter.onTestRunStart([vitestSpecification('unit')]);
      reporter.onTestCaseResult(vitestCase(directory, 'unit', 'passed'));
      reporter.onTestRunEnd([], [], 'passed');

      expect(readFileSync(unit, 'utf8')).toBe('retained unit release');
      expect(readFileSync(component, 'utf8')).toBe('retained component release');
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('clears only lanes selected for this invocation and writes actual terminal results', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-vitest-reporter-'));
    const unit = join(directory, 'unit.ndjson');
    const component = join(directory, 'component.ndjson');
    writeFileSync(unit, 'stale unit');
    writeFileSync(component, 'keep component');
    try {
      const reporter = new VitestParityEvidenceReporter({
        outputPaths: { component, unit },
        root: directory,
      });
      reporter.onTestRunStart([vitestSpecification('unit')]);
      expect(existsSync(unit)).toBe(false);
      expect(readFileSync(component, 'utf8')).toBe('keep component');

      reporter.onTestCaseResult(vitestCase(directory, 'unit', 'passed'));
      reporter.onTestRunEnd([], [], 'passed');

      expect(readEvidence(unit)).toEqual([expect.objectContaining({
        lane: 'unit',
        project: 'unit',
        source: 'tests/unit/runner.test.ts',
        status: 'passed',
        title: '@parity:workbook.runner-adapter runs through Vitest',
      })]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not publish partial passing evidence after interruption', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-vitest-interrupt-'));
    const unit = join(directory, 'unit.ndjson');
    try {
      const reporter = new VitestParityEvidenceReporter({
        outputPaths: { component: join(directory, 'component.ndjson'), unit },
        root: directory,
      });
      reporter.onTestRunStart([vitestSpecification('unit')]);
      reporter.onTestCaseResult(vitestCase(directory, 'unit', 'passed'));
      reporter.onTestRunEnd([], [], 'interrupted');

      expect(existsSync(unit)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not publish all-passing parity evidence from an otherwise failed Vitest run', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-vitest-failed-run-'));
    const unit = join(directory, 'unit.ndjson');
    try {
      const reporter = new VitestParityEvidenceReporter({
        outputPaths: { component: join(directory, 'component.ndjson'), unit },
        root: directory,
      });
      reporter.onTestRunStart([vitestSpecification('unit')]);
      reporter.onTestCaseResult(vitestCase(directory, 'unit', 'passed'));
      reporter.onTestRunEnd([], [], 'failed');

      expect(existsSync(unit)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('Playwright parity evidence reporter', () => {
  it('leaves retained release artifacts untouched during an ordinary development run', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-playwright-retained-release-'));
    const artifact = join(directory, 'browser.ndjson');
    writeFileSync(artifact, 'retained browser release');
    vi.stubEnv('TEGO_PARITY_RELEASE_CONTEXT', undefined);
    try {
      const reporter = new PlaywrightParityEvidenceReporter({
        lane: 'browser',
        outputPath: artifact,
        releaseOnly: true,
        root: directory,
      });
      reporter.onBegin();
      reporter.onTestEnd(playwrightCase(directory, 'chromium-desktop'), playwrightResult('passed'));
      reporter.onEnd({ status: 'passed' });

      expect(readFileSync(artifact, 'utf8')).toBe('retained browser release');
    } finally {
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps list output independent while aggregating pass, skip, and failure statuses', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-playwright-reporter-'));
    const artifact = join(directory, 'browser.ndjson');
    writeFileSync(artifact, 'stale');
    try {
      const reporter = new PlaywrightParityEvidenceReporter({
        lane: 'browser',
        listOnly: true,
        outputPath: artifact,
        root: directory,
      });
      expect(reporter.printsToStdio()).toBe(false);
      expect(readFileSync(artifact, 'utf8')).toBe('stale');
      reporter.onBegin();
      expect(readFileSync(artifact, 'utf8')).toBe('stale');

      reporter.onTestEnd(playwrightCase(directory, 'chromium-desktop'), playwrightResult('skipped'));
      reporter.onTestEnd(playwrightCase(directory, 'chromium-touch'), playwrightResult('passed'));
      reporter.onTestEnd(playwrightCase(directory, 'firefox-touch'), playwrightResult('failed'));
      reporter.onEnd({ status: 'failed' });

      expect(readEvidence(artifact)).toEqual([
        expect.objectContaining({ project: 'chromium-desktop', status: 'skipped' }),
        expect.objectContaining({ project: 'chromium-touch', status: 'passed' }),
        expect.objectContaining({ project: 'firefox-touch', status: 'failed' }),
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('clears stale evidence at real-run begin before a pre-test global failure', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-playwright-pretest-failure-'));
    const artifact = join(directory, 'browser.ndjson');
    writeFileSync(artifact, 'stale');
    try {
      const reporter = new PlaywrightParityEvidenceReporter({
        lane: 'browser',
        listOnly: false,
        outputPath: artifact,
        root: directory,
      });
      reporter.onBegin();
      expect(existsSync(artifact)).toBe(false);
      reporter.onError();
      reporter.onEnd({ status: 'failed' });
      expect(existsSync(artifact)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not publish all-passing parity evidence from an otherwise failed Playwright run', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-playwright-failed-run-'));
    const artifact = join(directory, 'browser.ndjson');
    try {
      const reporter = new PlaywrightParityEvidenceReporter({
        lane: 'browser',
        outputPath: artifact,
        root: directory,
      });
      reporter.onBegin();
      reporter.onTestEnd(playwrightCase(directory, 'chromium'), playwrightResult('passed'));
      reporter.onEnd({ status: 'failed' });

      expect(existsSync(artifact)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not publish partial evidence for timed out or interrupted runs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tego-playwright-interrupt-'));
    try {
      for (const status of ['timedout', 'interrupted'] as const) {
        const artifact = join(directory, `${status}.ndjson`);
        const reporter = new PlaywrightParityEvidenceReporter({
          lane: 'visual',
          outputPath: artifact,
          root: directory,
        });
        reporter.onBegin();
        reporter.onTestEnd(playwrightCase(directory, 'desktop-dpr1'), playwrightResult('passed'));
        reporter.onEnd({ status });
        expect(existsSync(artifact)).toBe(false);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
