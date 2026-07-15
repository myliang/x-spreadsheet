import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { runNpm } from './package-test-runtime.mjs';
import { parityReleaseContextPath } from './parity-release-contract.mjs';
import { createParityReleaseContext } from './parity-release-provenance.mjs';
import { defaultParityEvidencePaths } from './reporters/parity-evidence-paths.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const contextPath = resolve(root, parityReleaseContextPath);
const context = createParityReleaseContext(root);
const temporaryContextPath = `${contextPath}.${process.pid}.tmp`;

mkdirSync(dirname(contextPath), { recursive: true });
for (const path of defaultParityEvidencePaths) rmSync(resolve(root, path), { force: true });
writeFileSync(temporaryContextPath, `${JSON.stringify(context, null, 2)}\n`, 'utf8');
renameSync(temporaryContextPath, contextPath);

const env = {
  ...process.env,
  CI: process.env.CI ?? '1',
  TEGO_PARITY_RELEASE_CONTEXT: contextPath,
};

try {
  runNpm(['exec', '--', 'vitest', 'run'], root, { env, stdio: 'inherit' });
  runNpm(['exec', '--', 'playwright', 'test', 'tests/browser'], root, { env, stdio: 'inherit' });
  runNpm(['exec', '--', 'playwright', 'test', '--config', 'playwright.visual.config.ts'], root, { env, stdio: 'inherit' });
  execFileSync(process.execPath, [
    'scripts/test-parity-gate.mjs',
    '--context',
    contextPath,
    ...defaultParityEvidencePaths,
  ], { cwd: root, env, stdio: 'inherit' });
} catch (error) {
  for (const path of defaultParityEvidencePaths) rmSync(resolve(root, path), { force: true });
  throw error;
}
