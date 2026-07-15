import { fileURLToPath, URL } from 'node:url';
import { runNpm } from './package-test-runtime.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const evidencePaths = process.argv.length > 2
  ? process.argv.slice(2)
  : ['test-results/parity-evidence.ndjson'];

runNpm([
  'exec',
  '--',
  'vitest',
  'run',
  '--project',
  'parity',
  '--reporter=verbose',
  'tests/parity/manifest-gate.test.ts',
  'tests/parity/release-evidence.test.ts',
], repositoryRoot, {
  env: {
    ...process.env,
    TEGO_PARITY_EVIDENCE_PATHS: JSON.stringify(evidencePaths),
  },
  stdio: 'inherit',
});
