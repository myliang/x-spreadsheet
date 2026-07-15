import { readFileSync } from 'node:fs';
import { parityManifest } from '../tests/parity/manifest.ts';
import type {
  AssertionLane,
  EvidenceStatus,
  ParityEvidenceRecord,
  ParityLane,
} from '../tests/parity/manifest-types.ts';

const laneNames = ['unit', 'component', 'browser', 'visual'] as const;
const evidenceStatuses = ['passed', 'failed', 'skipped'] as const;
const rowPropertyNames = ['id', ...laneNames] as const;
const evidencePropertyNames = ['lane', 'status', 'title', 'source', 'project'] as const;
const requiredEvidencePropertyNames = ['lane', 'status', 'title', 'source'] as const;
const rowIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const assertionIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/;
const controlCharacterPattern = /[\u0000-\u001f\u007f-\u009f]/;
const mandatoryCorrectionIds = [
  'correction.empty-workbook',
  'correction.validation-all-sheets',
  'correction.sort-rendered-values',
  'correction.resource-cleanup',
  'correction.printable-cells',
] as const;

interface AssertionDeclaration {
  readonly rowId: string;
  readonly lane: ParityLane;
}

interface ValidatedEvidenceRecord extends ParityEvidenceRecord {
  readonly id: string;
}

export interface ManifestVerificationSummary {
  readonly rowCount: number;
  readonly assertionCount: number;
  readonly executedCount: number;
  readonly notApplicableLaneCount: number;
  readonly evidenceRecordCount: number;
  readonly passedEvidenceRecordCount: number;
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

function validateNoUnexpectedRowProperties(rowId: string, row: Record<string, unknown>): void {
  const unexpectedProperty = Object.keys(row).find(
    (propertyName) => !(rowPropertyNames as readonly string[]).includes(propertyName),
  );
  if (unexpectedProperty !== undefined) {
    throw new Error(`${rowId} row has unexpected property "${unexpectedProperty}"`);
  }
}

function validateRequiredRowProperties(rowId: string, row: Record<string, unknown>): void {
  for (const propertyName of rowPropertyNames) {
    if (!Object.hasOwn(row, propertyName)) {
      throw new Error(`${rowId} row is missing property "${propertyName}"`);
    }
  }
}

function validateLane(rowId: string, laneName: ParityLane, value: unknown): AssertionLane {
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

function extractEvidenceId(title: string, label: string): string {
  const candidates = title.trim().split(/\s+/).filter((token) => token.startsWith('@parity:'));
  const exactTokens = candidates.filter((token) => {
    const id = token.slice('@parity:'.length);
    return assertionIdPattern.test(id);
  });
  if (candidates.length !== 1 || exactTokens.length !== 1) {
    throw new Error(`${label} title must contain exactly one exact @parity:<id> token`);
  }
  return exactTokens[0].slice('@parity:'.length);
}

function validateEvidenceRecords(evidence: unknown): readonly ValidatedEvidenceRecord[] {
  if (!Array.isArray(evidence)) {
    throw new Error('execution evidence must be an array of structured records');
  }

  return evidence.map((value, index) => {
    const label = `evidence record ${index + 1}`;
    if (!isRecord(value)) {
      throw new Error(`${label} must be an object`);
    }

    for (const propertyName of requiredEvidencePropertyNames) {
      if (!Object.hasOwn(value, propertyName)) {
        throw new Error(`${label} is missing property "${propertyName}"`);
      }
    }
    const unexpectedProperty = Object.keys(value).find(
      (propertyName) => !(evidencePropertyNames as readonly string[]).includes(propertyName),
    );
    if (unexpectedProperty !== undefined) {
      throw new Error(`${label} has unexpected property "${unexpectedProperty}"`);
    }

    if (!laneNames.includes(value.lane as ParityLane)) {
      throw new Error(`${label} has invalid lane "${String(value.lane)}"`);
    }
    if (!evidenceStatuses.includes(value.status as EvidenceStatus)) {
      throw new Error(`${label} has invalid status "${String(value.status)}"`);
    }
    if (typeof value.title !== 'string') {
      throw new Error(`${label} must have a string title`);
    }
    if (typeof value.source !== 'string' || value.source.trim() === '') {
      throw new Error(`${label} must have a nonempty source`);
    }
    if (controlCharacterPattern.test(value.source)) {
      throw new Error(`${label} source must not contain control characters`);
    }
    if (
      Object.hasOwn(value, 'project')
      && (typeof value.project !== 'string' || value.project.trim() === '')
    ) {
      throw new Error(`${label} project must be a nonempty string when provided`);
    }
    if (typeof value.project === 'string' && controlCharacterPattern.test(value.project)) {
      throw new Error(`${label} project must not contain control characters`);
    }

    return {
      lane: value.lane as ParityLane,
      status: value.status as EvidenceStatus,
      title: value.title,
      source: value.source,
      ...(value.project === undefined ? {} : { project: value.project as string }),
      id: extractEvidenceId(value.title, label),
    };
  });
}

export function verifyManifest(
  rows: readonly unknown[],
  evidence?: unknown,
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

  const assertions = new Map<string, AssertionDeclaration>();
  let notApplicableLaneCount = 0;

  for (const row of records) {
    const rowId = row.id as string;
    validateNoUnexpectedRowProperties(rowId, row);
    const hasAllRequiredProperties = rowPropertyNames.every((propertyName) =>
      Object.hasOwn(row, propertyName),
    );
    if (!hasAllRequiredProperties && rawExecutableCount(row) === 0) {
      throw new Error(`${rowId} has no executable assertion`);
    }
    validateRequiredRowProperties(rowId, row);

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
        const prior = assertions.get(assertionId);
        if (prior !== undefined) {
          throw new Error(
            `assertion "${assertionId}" is declared by both row "${prior.rowId}" and row "${rowId}"`,
          );
        }
        assertions.set(assertionId, { rowId, lane: laneName });
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

  let evidenceRecordCount = 0;
  let passedEvidenceRecordCount = 0;
  const passedIds = new Set<string>();
  const observedRecords = new Map<string, ValidatedEvidenceRecord[]>();

  if (evidence !== undefined) {
    const evidenceRecords = validateEvidenceRecords(evidence);
    evidenceRecordCount = evidenceRecords.length;

    for (const record of evidenceRecords) {
      const declaration = assertions.get(record.id);
      if (declaration === undefined) {
        throw new Error(`evidence assertion "${record.id}" is not declared in the manifest`);
      }
      if (declaration.lane !== record.lane) {
        throw new Error(
          `evidence assertion "${record.id}" is declared in ${declaration.lane} but reported in ${record.lane}`,
        );
      }

      const recordsForAssertion = observedRecords.get(record.id) ?? [];
      recordsForAssertion.push(record);
      observedRecords.set(record.id, recordsForAssertion);
      if (record.status === 'passed') {
        passedEvidenceRecordCount += 1;
        passedIds.add(record.id);
      }
    }

    for (const [assertionId, declaration] of assertions) {
      const recordsForAssertion = observedRecords.get(assertionId);
      if (recordsForAssertion === undefined) {
        throw new Error(
          `assertion "${assertionId}" declared by row "${declaration.rowId}" was not executed`,
        );
      }

      const recordSummary = recordsForAssertion
        .map(
          (record) =>
            `status=${record.status} source="${record.source}" project="${record.project ?? '<none>'}"`,
        )
        .join('; ');
      if (!passedIds.has(assertionId)) {
        throw new Error(
          `assertion "${assertionId}" declared by row "${declaration.rowId}" has no passed evidence; observed records: ${recordSummary}`,
        );
      }
      if (recordsForAssertion.some(({ status }) => status !== 'passed')) {
        throw new Error(
          `assertion "${assertionId}" declared by row "${declaration.rowId}" has mixed terminal outcomes; every retained record must pass; observed records: ${recordSummary}`,
        );
      }
    }
  }

  return {
    rowCount: records.length,
    assertionCount: assertions.size,
    executedCount: passedIds.size,
    notApplicableLaneCount,
    evidenceRecordCount,
    passedEvidenceRecordCount,
  };
}

export function parseEvidenceArtifact(path: string): unknown[] {
  let contents: string;
  try {
    contents = readFileSync(path, 'utf8').trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`could not read execution artifact ${JSON.stringify(path)}: ${message}`);
  }
  if (contents === '') {
    throw new Error(`execution artifact "${path}" is empty`);
  }

  if (contents.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`execution artifact ${JSON.stringify(path)} has invalid JSON: ${message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`execution artifact "${path}" must contain a JSON array or NDJSON records`);
    }
    return parsed;
  }

  return contents.split(/\r?\n/).map((line, index) => {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      throw new Error(
        `execution artifact ${JSON.stringify(path)} has invalid NDJSON at line ${index + 1}`,
      );
    }
  });
}

export function verifyEvidenceArtifacts(args: readonly string[]): ManifestVerificationSummary {
  if (args.length === 0) {
    throw new Error('missing execution artifact; pass one or more JSON-array or NDJSON record files');
  }

  const evidence = args.flatMap(parseEvidenceArtifact);
  return verifyManifest(parityManifest, evidence);
}

export interface ParityCliIo {
  readonly error: (message: string) => void;
  readonly log: (message: string) => void;
}

export function runParityCli(
  args: readonly string[],
  io: ParityCliIo = { error: console.error, log: console.log },
): number {
  try {
    const summary = verifyEvidenceArtifacts(args);
    io.log(
      `Verified parity manifest: ${summary.rowCount} rows, ${summary.assertionCount} assertions, ${summary.executedCount} covered by ${summary.evidenceRecordCount} evidence records.`,
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.error(`Parity manifest verification failed: ${message}`);
    return 1;
  }
}
