import { test } from 'vitest';
import { verifyReleaseEvidenceArtifacts } from '../../scripts/verify-parity-manifest.ts';

const serializedPaths = process.env.TEGO_PARITY_EVIDENCE_PATHS;
const releaseContextPath = process.env.TEGO_PARITY_RELEASE_CONTEXT;
const releaseTest = serializedPaths === undefined || releaseContextPath === undefined ? test.skip : test;

releaseTest('@parity:manifest.release-evidence verifies retained release execution records', () => {
  const paths: unknown = JSON.parse(serializedPaths ?? '[]');
  if (!Array.isArray(paths) || !paths.every(path => typeof path === 'string')) {
    throw new Error('TEGO_PARITY_EVIDENCE_PATHS must be a JSON array of paths');
  }
  verifyReleaseEvidenceArtifacts(paths, releaseContextPath!);
});
