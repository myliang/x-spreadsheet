import {
  mkdirSync as nodeMkdirSync,
  readFileSync as nodeReadFileSync,
  readdirSync as nodeReaddirSync,
  renameSync as nodeRenameSync,
  rmSync as nodeRmSync,
  writeFileSync as nodeWriteFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import type {
  EvidenceStatus,
  ParityEvidenceRecord,
  ParityEvidenceProvenance,
  ParityReleaseContext,
  ParityLane,
} from '../../tests/parity/manifest-types.ts';

const assertionIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;

export interface ObservedParityResult extends Omit<ParityEvidenceRecord, keyof ParityEvidenceProvenance> {
  readonly project: string;
}

function readReleaseProvenance(lane: ParityLane): Omit<ParityEvidenceProvenance, 'observedAt'> {
  const contextPath = process.env.TEGO_PARITY_RELEASE_CONTEXT;
  if (contextPath === undefined) {
    const startedAt = new Date().toISOString();
    return {
      runId: `development-${process.pid}-${randomUUID()}`,
      revision: 'development',
      treeHash: 'development',
      manifestHash: 'development',
      runner: 'development',
      configHash: 'development',
      startedAt,
    };
  }
  const context = JSON.parse(
    // The release orchestrator owns this file; reporters only consume its immutable identity.
    requireReadFile(contextPath),
  ) as ParityReleaseContext;
  const laneContext = context.lanes[lane];
  return {
    runId: context.runId,
    revision: context.revision,
    treeHash: context.treeHash,
    manifestHash: context.manifestHash,
    runner: laneContext.runner,
    configHash: laneContext.configHash,
    startedAt: context.startedAt,
  };
}

function requireReadFile(path: string): string {
  // Kept behind a tiny wrapper so evidence construction stays deterministic in tests.
  return nodeReadFileSync(path, 'utf8');
}

export interface EvidenceFileSystem {
  readonly mkdirSync: (path: string, options: { readonly recursive: true }) => unknown;
  readonly readdirSync: (path: string) => readonly string[];
  readonly renameSync: (oldPath: string, newPath: string) => void;
  readonly rmSync: (path: string, options: { readonly force: true }) => void;
  readonly writeFileSync: (path: string, contents: string, encoding: 'utf8') => void;
}

const nodeFileSystem: EvidenceFileSystem = {
  mkdirSync: (path, options) => nodeMkdirSync(path, options),
  readdirSync: path => nodeReaddirSync(path),
  renameSync: (oldPath, newPath) => nodeRenameSync(oldPath, newPath),
  rmSync: (path, options) => nodeRmSync(path, options),
  writeFileSync: (path, contents, encoding) => nodeWriteFileSync(path, contents, encoding),
};

function parityGroup(title: string): string | null {
  if (!title.includes('@parity:')) return null;
  const candidates = title.trim().split(/\s+/).filter(token => token.startsWith('@parity:'));
  if (candidates.length === 1) {
    const id = candidates[0]!.slice('@parity:'.length);
    if (assertionIdPattern.test(id)) return `assertion:${id}`;
  }
  return `malformed:${title}`;
}

function aggregateStatus(statuses: ReadonlySet<EvidenceStatus>): EvidenceStatus {
  if (statuses.has('failed')) return 'failed';
  if (statuses.has('passed')) return 'passed';
  return 'skipped';
}

export function aggregateParityEvidence(
  observations: readonly ObservedParityResult[],
  provenance: Omit<ParityEvidenceProvenance, 'observedAt'> = readReleaseProvenance(
    observations[0]?.lane ?? 'unit',
  ),
): ParityEvidenceRecord[] {
  const groups = new Map<string, {
    lane: ParityLane;
    projects: Set<string>;
    sources: Set<string>;
    statuses: Set<EvidenceStatus>;
    titles: Set<string>;
  }>();

  for (const observation of observations) {
    const group = parityGroup(observation.title);
    if (group === null) continue;
    const key = `${observation.lane}:${group}:${observation.project}`;
    const accumulated = groups.get(key) ?? {
      lane: observation.lane,
      projects: new Set<string>(),
      sources: new Set<string>(),
      statuses: new Set<EvidenceStatus>(),
      titles: new Set<string>(),
    };
    accumulated.projects.add(observation.project);
    accumulated.sources.add(observation.source);
    accumulated.statuses.add(observation.status);
    accumulated.titles.add(observation.title);
    groups.set(key, accumulated);
  }

  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, group]) => ({
      lane: group.lane,
      ...provenance,
      observedAt: new Date().toISOString(),
      project: [...group.projects][0]!,
      source: [...group.sources].sort().join(', '),
      status: aggregateStatus(group.statuses),
      title: [...group.titles].sort()[0]!,
    }));
}

function temporaryPrefix(path: string): string {
  return `.${basename(path)}.`;
}

export function clearEvidenceArtifact(
  path: string,
  fileSystem: EvidenceFileSystem = nodeFileSystem,
): void {
  const directory = dirname(path);
  fileSystem.mkdirSync(directory, { recursive: true });
  fileSystem.rmSync(path, { force: true });
  const prefix = temporaryPrefix(path);
  for (const entry of fileSystem.readdirSync(directory)) {
    if (entry.startsWith(prefix) && entry.endsWith('.tmp')) {
      fileSystem.rmSync(join(directory, entry), { force: true });
    }
  }
}

export function writeEvidenceArtifactAtomically(
  path: string,
  evidence: readonly ParityEvidenceRecord[],
  fileSystem: EvidenceFileSystem = nodeFileSystem,
): void {
  const directory = dirname(path);
  fileSystem.mkdirSync(directory, { recursive: true });
  const temporaryPath = join(
    directory,
    `${temporaryPrefix(path)}${process.pid}.${randomUUID()}.tmp`,
  );
  const contents = evidence.length === 0
    ? '[]'
    : evidence.map(record => JSON.stringify(record)).join('\n');
  try {
    fileSystem.writeFileSync(temporaryPath, `${contents}\n`, 'utf8');
    fileSystem.renameSync(temporaryPath, path);
  } finally {
    fileSystem.rmSync(temporaryPath, { force: true });
  }
}
