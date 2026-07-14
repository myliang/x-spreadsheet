export type AssertionLane =
  | { readonly assertions: readonly string[] }
  | { readonly notApplicable: string };

export interface ParityRow {
  readonly id: string;
  readonly unit: AssertionLane;
  readonly component: AssertionLane;
  readonly browser: AssertionLane;
  readonly visual: AssertionLane;
}
