import { fileURLToPath, URL } from 'node:url';
import { buildAndInstallPackedConsumer, runNodeTests } from './package-test-runtime.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const consumer = buildAndInstallPackedConsumer(repositoryRoot);

try {
  runNodeTests(repositoryRoot, [
    'tests/package/package-exports.test.mjs',
    'tests/package/packed-consumer.test.mjs',
    'tests/package/package-metadata.check.mjs',
    'tests/package/quality-gates.test.mjs',
  ], consumer);
} finally {
  consumer.cleanup();
}
