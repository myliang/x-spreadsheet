import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { buildAndInstallPackedConsumer, runNodeTests } from './package-test-runtime.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const consumer = buildAndInstallPackedConsumer(repositoryRoot);

try {
  runNodeTests(repositoryRoot, ['tests/ssr/public-entrypoints.test.mjs'], consumer);
  execFileSync(process.execPath, [
    resolve(repositoryRoot, 'node_modules/vitest/vitest.mjs'),
    'run',
    'tests/ssr/controller-epoch.test.tsx',
  ], {
    cwd: repositoryRoot,
    stdio: 'inherit',
  });
} finally {
  consumer.cleanup();
}
