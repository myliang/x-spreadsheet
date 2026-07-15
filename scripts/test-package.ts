import { fileURLToPath } from 'node:url';
import { buildAndInstallPackedConsumer, runNodeTests } from './package-test-runtime.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const consumer = buildAndInstallPackedConsumer(repositoryRoot);

try {
  runNodeTests(repositoryRoot, [
    'tests/package/package-exports.test.ts',
    'tests/package/packed-consumer.test.ts',
    'tests/package/package-metadata.check.mjs',
  ], consumer);
} finally {
  consumer.cleanup();
}
