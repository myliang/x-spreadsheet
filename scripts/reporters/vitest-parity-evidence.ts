import { relative, resolve, sep } from 'node:path';
import type { Reporter } from 'vitest/reporters';
import type { EvidenceStatus } from '../../tests/parity/manifest-types.ts';
import { parityEvidencePaths } from './parity-evidence-paths.mjs';
import {
  aggregateParityEvidence,
  clearEvidenceArtifact,
  writeEvidenceArtifactAtomically,
  type ObservedParityResult,
} from './parity-evidence.ts';

type VitestEvidenceLane = 'unit' | 'component';
type TestCase = Parameters<NonNullable<Reporter['onTestCaseResult']>>[0];
type TestSpecification = Parameters<NonNullable<Reporter['onTestRunStart']>>[0][number];
type TestRunEndReason = Parameters<NonNullable<Reporter['onTestRunEnd']>>[2];

export interface VitestParityEvidenceReporterOptions {
  readonly outputPaths?: Readonly<Record<VitestEvidenceLane, string>>;
  readonly releaseOnly?: boolean;
  readonly root?: string;
}

function portableRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

function evidenceStatus(state: ReturnType<TestCase['result']>['state']): EvidenceStatus {
  if (state === 'passed' || state === 'skipped') return state;
  return 'failed';
}

function isEvidenceLane(project: string): project is VitestEvidenceLane {
  return project === 'unit' || project === 'component';
}

export default class VitestParityEvidenceReporter implements Reporter {
  private readonly enabled: boolean;
  private readonly observations: ObservedParityResult[] = [];
  private readonly outputPaths: Readonly<Record<VitestEvidenceLane, string>>;
  private readonly root: string;
  private readonly selectedLanes = new Set<VitestEvidenceLane>();

  constructor(options: VitestParityEvidenceReporterOptions = {}) {
    this.enabled = options.releaseOnly !== true
      || process.env.TEGO_PARITY_RELEASE_CONTEXT !== undefined;
    this.root = resolve(options.root ?? process.cwd());
    this.outputPaths = options.outputPaths ?? {
      component: resolve(this.root, parityEvidencePaths.component),
      unit: resolve(this.root, parityEvidencePaths.unit),
    };
  }

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>): void {
    if (!this.enabled) return;
    this.observations.length = 0;
    this.selectedLanes.clear();
    for (const specification of specifications) {
      const project = specification.project.name;
      if (isEvidenceLane(project)) this.selectedLanes.add(project);
    }
    for (const lane of this.selectedLanes) clearEvidenceArtifact(this.outputPaths[lane]);
  }

  onTestCaseResult(testCase: TestCase): void {
    if (!this.enabled) return;
    const project = testCase.project.name;
    if (!isEvidenceLane(project) || !this.selectedLanes.has(project)) return;
    this.observations.push({
      lane: project,
      project,
      source: portableRelative(this.root, testCase.module.moduleId),
      status: evidenceStatus(testCase.result().state),
      title: testCase.fullName,
    });
  }

  onTestRunEnd(
    _testModules: Parameters<NonNullable<Reporter['onTestRunEnd']>>[0],
    unhandledErrors: Parameters<NonNullable<Reporter['onTestRunEnd']>>[1],
    reason: TestRunEndReason,
  ): void {
    if (!this.enabled) return;
    if (reason === 'interrupted' || unhandledErrors.length > 0) return;
    const evidenceByLane = new Map([...this.selectedLanes].map(lane => [
      lane,
      aggregateParityEvidence(
        this.observations.filter(observation => observation.lane === lane),
      ),
    ]));
    if (
      reason === 'failed'
      && ![...evidenceByLane.values()].some(evidence => (
        evidence.some(record => record.status === 'failed')
      ))
    ) return;
    for (const lane of this.selectedLanes) {
      writeEvidenceArtifactAtomically(this.outputPaths[lane], evidenceByLane.get(lane)!);
    }
  }
}
