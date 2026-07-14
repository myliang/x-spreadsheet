import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parityManifest } from '../tests/parity/manifest.ts';
import type { AssertionLane } from '../tests/parity/manifest-types.ts';

const laneNames = ['unit', 'component', 'browser', 'visual'] as const;
const rowIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const assertionIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;
const mandatoryCorrectionIds = [
  'correction.empty-workbook',
  'correction.validation-all-sheets',
  'correction.sort-rendered-values',
  'correction.resource-cleanup',
  'correction.printable-cells',
] as const;

export interface ManifestVerificationSummary {
  readonly rowCount: number;
  readonly assertionCount: number;
  readonly executedCount: number;
  readonly notApplicableLaneCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rawExecutableCount(row: Record<string, unknown>): number | undefined {
  const assertionDeclarations = laneNames
    .map((laneName) => row[laneName])
    .filter(isRecord)
    .filter((lane) => Object.hasOwn(lane, 'assertions'))
    .map((lane) => lane.assertions);

  if (assertionDeclarations.length === 0 || !assertionDeclarations.every(Array.isArray)) {
    return undefined;
  }

  return assertionDeclarations.reduce<number>((count, assertions) => count + assertions.length, 0);
}

function validateLane(rowId: string, laneName: (typeof laneNames)[number], value: unknown): AssertionLane {
  const label = `${rowId}.${laneName}`;
  if (!isRecord(value)) {
    throw new Error(`${label} must be a valid lane object`);
  }

  const hasAssertions = Object.hasOwn(value, 'assertions');
  const hasNotApplicable = Object.hasOwn(value, 'notApplicable');
  if (hasAssertions === hasNotApplicable) {
    throw new Error(`${label} must contain exactly one of assertions or notApplicable`);
  }

  const expectedKey = hasAssertions ? 'assertions' : 'notApplicable';
  const unexpectedKey = Object.keys(value).find((key) => key !== expectedKey);
  if (unexpectedKey !== undefined) {
    throw new Error(`${label} has unexpected property "${unexpectedKey}"`);
  }

  if (hasAssertions) {
    if (!Array.isArray(value.assertions) || value.assertions.length === 0) {
      throw new Error(`${label} assertions must be a nonempty array`);
    }
    return value as { readonly assertions: readonly string[] };
  }

  if (typeof value.notApplicable !== 'string' || value.notApplicable.trim() === '') {
    throw new Error(`${label} must have a nonempty notApplicable explanation`);
  }
  return value as { readonly notApplicable: string };
}

function validateRowsInput(rows: readonly unknown[]): readonly Record<string, unknown>[] {
  if (!Array.isArray(rows)) {
    throw new Error('manifest rows must be an array');
  }

  return rows.map((row, index) => {
    if (!isRecord(row)) {
      throw new Error(`row ${index + 1} must be an object`);
    }
    return row;
  });
}

export function verifyManifest(
  rows: readonly unknown[],
  executedIds?: ReadonlySet<string>,
): ManifestVerificationSummary {
  const records = validateRowsInput(rows);
  const rowIds = new Set<string>();

  for (const [index, row] of records.entries()) {
    if (typeof row.id !== 'string' || row.id.trim() === '') {
      throw new Error(`row ${index + 1} has an empty ID`);
    }
    if (!rowIdPattern.test(row.id)) {
      throw new Error(`row ${index + 1} has malformed ID "${row.id}"`);
    }
    if (rowIds.has(row.id)) {
      throw new Error(`duplicate row ID "${row.id}"`);
    }
    rowIds.add(row.id);
  }

  const assertions = new Map<string, string>();
  let notApplicableLaneCount = 0;

  for (const row of records) {
    const rowId = row.id as string;
    if (rawExecutableCount(row) === 0) {
      throw new Error(`${rowId} has no executable assertion`);
    }

    let rowAssertionCount = 0;
    for (const laneName of laneNames) {
      const lane = validateLane(rowId, laneName, row[laneName]);
      if ('notApplicable' in lane) {
        notApplicableLaneCount += 1;
        continue;
      }

      rowAssertionCount += lane.assertions.length;
      for (const assertionId of lane.assertions) {
        if (typeof assertionId !== 'string' || !assertionIdPattern.test(assertionId)) {
          throw new Error(`${rowId}.${laneName} assertion "${String(assertionId)}" is malformed`);
        }
        const priorRow = assertions.get(assertionId);
        if (priorRow !== undefined) {
          throw new Error(
            `assertion "${assertionId}" is declared by both row "${priorRow}" and row "${rowId}"`,
          );
        }
        assertions.set(assertionId, rowId);
      }
    }

    if (rowAssertionCount === 0) {
      throw new Error(`${rowId} has no executable assertion`);
    }
  }

  for (const correctionId of mandatoryCorrectionIds) {
    if (!rowIds.has(correctionId)) {
      throw new Error(`mandatory correction row "${correctionId}" is missing`);
    }
  }

  if (executedIds !== undefined) {
    for (const [assertionId, rowId] of assertions) {
      if (!executedIds.has(assertionId)) {
        throw new Error(`assertion "${assertionId}" declared by row "${rowId}" was not executed`);
      }
    }
    for (const executedId of executedIds) {
      if (typeof executedId !== 'string' || !assertionIdPattern.test(executedId)) {
        throw new Error(`executed assertion "${String(executedId)}" is malformed`);
      }
      if (!assertions.has(executedId)) {
        throw new Error(`executed assertion "${executedId}" is not declared in the manifest`);
      }
    }
  }

  return {
    rowCount: records.length,
    assertionCount: assertions.size,
    executedCount: executedIds?.size ?? 0,
    notApplicableLaneCount,
  };
}

export function extractParityEvidence(titles: readonly string[]): Set<string> {
  const evidence = new Set<string>();

  for (const title of titles) {
    if (typeof title !== 'string') {
      throw new Error(`evidence title "${String(title)}" is not a string`);
    }
    const candidates = title.trim().split(/\s+/).filter((token) => token.startsWith('@parity:'));
    const exactTokens = candidates.filter((token) => {
      const id = token.slice('@parity:'.length);
      return assertionIdPattern.test(id);
    });
    if (candidates.length !== 1 || exactTokens.length !== 1) {
      throw new Error(`evidence title "${title}" does not contain exactly one exact @parity:<id> token`);
    }

    const id = exactTokens[0].slice('@parity:'.length);
    if (evidence.has(id)) {
      throw new Error(`duplicate evidence ID "${id}"`);
    }
    evidence.add(id);
  }

  return evidence;
}

function readEvidenceTitles(paths: readonly string[]): string[] {
  const titles: string[] = [];
  for (const path of paths) {
    const contents = readFileSync(path, 'utf8').trim();
    if (contents === '') {
      throw new Error(`execution artifact "${path}" is empty`);
    }

    if (contents.startsWith('[')) {
      const parsed: unknown = JSON.parse(contents);
      if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
        throw new Error(`execution artifact "${path}" must be a JSON string array or newline-delimited titles`);
      }
      titles.push(...parsed);
    } else {
      titles.push(...contents.split(/\r?\n/).filter((line) => line.trim() !== ''));
    }
  }
  return titles;
}

function runCli(args: readonly string[]): void {
  if (args.length === 0) {
    throw new Error(
      'missing execution artifact; pass one or more JSON-array or newline-delimited test-title files',
    );
  }

  const evidence = extractParityEvidence(readEvidenceTitles(args));
  const summary = verifyManifest(parityManifest, evidence);
  console.log(
    `Verified parity manifest: ${summary.rowCount} rows, ${summary.assertionCount} assertions, ${summary.executedCount} executed.`,
  );
}

const entryPath = process.argv[1];
const isDirectExecution =
  entryPath !== undefined && import.meta.url === pathToFileURL(resolve(entryPath)).href;

if (isDirectExecution) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Parity manifest verification failed: ${message}`);
    process.exitCode = 1;
  }
}
