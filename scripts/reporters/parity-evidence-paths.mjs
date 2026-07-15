export const parityEvidencePaths = Object.freeze({
  browser: 'test-results/parity/browser.ndjson',
  component: 'test-results/parity/component.ndjson',
  unit: 'test-results/parity/unit.ndjson',
  visual: 'test-results/parity/visual.ndjson',
});

export const defaultParityEvidencePaths = Object.freeze([
  parityEvidencePaths.unit,
  parityEvidencePaths.component,
  parityEvidencePaths.browser,
  parityEvidencePaths.visual,
]);
