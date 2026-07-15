import { fileURLToPath, URL } from 'node:url';
import { runNpm } from './package-test-runtime.mjs';
import { defaultParityEvidencePaths } from './reporters/parity-evidence-paths.mjs';
import { parityReleaseContextPath } from './parity-release-contract.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const contextFlag = args.indexOf('--context');
const contextPath = contextFlag === -1
  ? parityReleaseContextPath
  : args[contextFlag + 1];
if (typeof contextPath !== 'string' || contextPath === '') {
  throw new Error('--context requires a parity release context path');
}
const evidenceArgs = contextFlag === -1
  ? args
  : args.filter((_, index) => index !== contextFlag && index !== contextFlag + 1);
const evidencePaths = evidenceArgs.length > 0 ? evidenceArgs : defaultParityEvidencePaths;

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
    TEGO_PARITY_RELEASE_CONTEXT: contextPath,
  },
  stdio: 'inherit',
});
