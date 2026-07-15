export declare const parityEvidencePaths: Readonly<{
  readonly browser: 'test-results/parity/browser.ndjson';
  readonly component: 'test-results/parity/component.ndjson';
  readonly unit: 'test-results/parity/unit.ndjson';
  readonly visual: 'test-results/parity/visual.ndjson';
}>;

export declare const defaultParityEvidencePaths: readonly [
  typeof parityEvidencePaths.unit,
  typeof parityEvidencePaths.component,
  typeof parityEvidencePaths.browser,
  typeof parityEvidencePaths.visual,
];
