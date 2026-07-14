export type AssertionLane =
  | { readonly assertions: readonly string[] }
  | { readonly notApplicable: string };

export type ParityLane = 'unit' | 'component' | 'browser' | 'visual';

export type EvidenceStatus = 'passed' | 'failed' | 'skipped';

export interface ParityEvidenceRecord {
  readonly lane: ParityLane;
  readonly status: EvidenceStatus;
  readonly title: string;
  readonly source: string;
  readonly project?: string;
}

export interface ParityRow {
  readonly id: string;
  readonly unit: AssertionLane;
  readonly component: AssertionLane;
  readonly browser: AssertionLane;
  readonly visual: AssertionLane;
}
