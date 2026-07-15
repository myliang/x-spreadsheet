import { relative, resolve, sep } from 'node:path';
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import type { EvidenceStatus, ParityLane } from '../../tests/parity/manifest-types.ts';
import {
  aggregateParityEvidence,
  clearEvidenceArtifact,
  writeEvidenceArtifactAtomically,
  type ObservedParityResult,
} from './parity-evidence.ts';

export interface PlaywrightParityEvidenceReporterOptions {
  readonly lane: Extract<ParityLane, 'browser' | 'visual'>;
  readonly listOnly?: boolean;
  readonly outputPath: string;
  readonly root?: string;
}

function portableRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

function evidenceStatus(status: TestResult['status']): EvidenceStatus {
  if (status === 'passed' || status === 'skipped') return status;
  return 'failed';
}

export default class PlaywrightParityEvidenceReporter implements Reporter {
  private hasGlobalError = false;
  private hasTestResult = false;
  private readonly listOnly: boolean;
  private readonly lane: Extract<ParityLane, 'browser' | 'visual'>;
  private readonly observations: ObservedParityResult[] = [];
  private readonly outputPath: string;
  private readonly root: string;

  constructor(options: PlaywrightParityEvidenceReporterOptions) {
    this.lane = options.lane;
    this.listOnly = options.listOnly ?? process.argv.includes('--list');
    this.outputPath = resolve(options.outputPath);
    this.root = resolve(options.root ?? process.cwd());
  }

  onBegin(): void {
    this.hasGlobalError = false;
    this.hasTestResult = false;
    this.observations.length = 0;
    if (!this.listOnly) clearEvidenceArtifact(this.outputPath);
  }

  onError(): void {
    this.hasGlobalError = true;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.hasTestResult = true;
    this.observations.push({
      lane: this.lane,
      project: test.parent.project()?.name ?? 'unknown-project',
      source: portableRelative(this.root, test.location.file),
      status: evidenceStatus(result.status),
      title: test.title,
    });
  }

  onEnd(result: Pick<FullResult, 'status'>): void {
    if (!this.hasTestResult) return;
    if (this.hasGlobalError || result.status === 'interrupted' || result.status === 'timedout') return;
    const evidence = aggregateParityEvidence(this.observations);
    if (result.status === 'failed' && !evidence.some(record => record.status === 'failed')) return;
    writeEvidenceArtifactAtomically(this.outputPath, evidence);
  }

  printsToStdio(): boolean {
    return false;
  }
}
