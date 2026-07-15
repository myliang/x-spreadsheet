export type AssertionLane =
  | { readonly assertions: readonly string[] }
  | { readonly notApplicable: string };

export type ParityLane = 'unit' | 'component' | 'browser' | 'visual';

export type EvidenceStatus = 'passed' | 'failed' | 'skipped';

export interface ParityEvidenceProvenance {
  readonly runId: string;
  readonly revision: string;
  readonly treeHash: string;
  readonly manifestHash: string;
  readonly runner: string;
  readonly configHash: string;
  readonly startedAt: string;
  readonly observedAt: string;
}

export interface ParityEvidenceRecord extends ParityEvidenceProvenance {
  readonly lane: ParityLane;
  readonly status: EvidenceStatus;
  readonly title: string;
  readonly source: string;
  readonly project?: string;
}

export interface ParityReleaseLaneContext {
  readonly runner: string;
  readonly configHash: string;
  readonly expectedProjects: readonly string[];
  readonly allowedProjectSkips: Readonly<Record<string, readonly string[]>>;
}

export interface ParityReleaseContext {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly revision: string;
  readonly treeHash: string;
  readonly manifestHash: string;
  readonly startedAt: string;
  readonly expiresAt: string;
  readonly lanes: Readonly<Record<ParityLane, ParityReleaseLaneContext>>;
}

export interface ParityRow {
  readonly id: string;
  readonly unit: AssertionLane;
  readonly component: AssertionLane;
  readonly browser: AssertionLane;
  readonly visual: AssertionLane;
}
