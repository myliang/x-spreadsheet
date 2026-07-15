import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parityAllowedProjectSkips,
  parityLaneConfigFiles,
  parityProjectContract,
} from './parity-release-contract.mjs';

const lanes = ['unit', 'component', 'browser', 'visual'];

export function hashReleaseFiles(root, paths) {
  const hash = createHash('sha256');
  for (const path of [...paths].sort()) {
    hash.update(path);
    hash.update('\0');
    hash.update(readFileSync(resolve(root, path)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function assertCleanRepository(root) {
  const status = git(root, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status !== '') {
    throw new Error('parity release requires a clean repository so the revision and tree fingerprint are exact');
  }
}

export function computeParityReleaseIdentity(root) {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const vitest = packageJson.devDependencies?.vitest;
  const playwright = packageJson.devDependencies?.['@playwright/test'];
  if (typeof vitest !== 'string' || typeof playwright !== 'string') {
    throw new Error('parity release runner versions must be pinned in devDependencies');
  }
  return {
    revision: git(root, ['rev-parse', 'HEAD']),
    treeHash: git(root, ['rev-parse', 'HEAD^{tree}']),
    manifestHash: hashReleaseFiles(root, ['tests/parity/manifest.ts']),
    lanes: Object.fromEntries(lanes.map(lane => [lane, {
      runner: lane === 'unit' || lane === 'component'
        ? `vitest@${vitest}`
        : `playwright@${playwright}`,
      configHash: hashReleaseFiles(root, parityLaneConfigFiles[lane]),
      expectedProjects: [...parityProjectContract[lane]],
      allowedProjectSkips: Object.fromEntries(
        Object.entries(parityAllowedProjectSkips[lane]).map(([id, projects]) => [id, [...projects]]),
      ),
    }])),
  };
}

export function createParityReleaseContext(root, now = new Date()) {
  assertCleanRepository(root);
  const identity = computeParityReleaseIdentity(root);
  return {
    schemaVersion: 1,
    runId: randomUUID(),
    ...identity,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

export function assertParityReleaseContextCurrent(context, root, now = new Date()) {
  assertCleanRepository(root);
  if (context?.schemaVersion !== 1 || typeof context.runId !== 'string') {
    throw new Error('parity release context has an unsupported or malformed schema');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.runId)) {
    throw new Error('parity release context run ID must be a random UUID');
  }
  const started = Date.parse(context.startedAt);
  const expires = Date.parse(context.expiresAt);
  if (Number.isNaN(started) || Number.isNaN(expires) || now.getTime() < started || now.getTime() > expires) {
    throw new Error('parity release context is stale or outside its validity window');
  }
  const current = computeParityReleaseIdentity(root);
  for (const property of ['revision', 'treeHash', 'manifestHash']) {
    if (context[property] !== current[property]) {
      throw new Error(`parity release context ${property} does not match the current repository`);
    }
  }
  for (const lane of lanes) {
    const actual = context.lanes?.[lane];
    const expected = current.lanes[lane];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`parity release context ${lane} runner, config, project matrix, or skip contract is stale`);
    }
  }
}
