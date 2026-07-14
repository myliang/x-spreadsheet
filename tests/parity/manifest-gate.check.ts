import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { verifyManifest } from '../../scripts/verify-parity-manifest.ts';
import { parityManifest } from './manifest.ts';
import type {
  EvidenceStatus,
  ParityEvidenceRecord,
  ParityLane,
  ParityRow,
} from './manifest-types.ts';

test('@parity:manifest.all-rows-covered rejects an uncovered row', () => {
  assert.throws(
    () => verifyManifest([{ id: 'workbook', unit: { assertions: [] } }], new Set()),
    /workbook has no executable assertion/,
  );
});

const lanes = ['unit', 'component', 'browser', 'visual'] as const;
const correctionIds = [
  'correction.empty-workbook',
  'correction.validation-all-sheets',
  'correction.sort-rendered-values',
  'correction.resource-cleanup',
  'correction.printable-cells',
] as const;

function row(id: string, assertionId = `${id}.unit`): ParityRow {
  return {
    id,
    unit: { assertions: [assertionId] },
    component: { notApplicable: 'Covered as a pure model operation.' },
    browser: { notApplicable: 'No browser integration is involved.' },
    visual: { notApplicable: 'The behavior has no visible state.' },
  };
}

function validRows(): ParityRow[] {
  return [row('workbook'), ...correctionIds.map((id) => row(id, id))];
}

function declarations(rows: readonly ParityRow[]): Array<{ id: string; lane: ParityLane }> {
  return rows.flatMap((entry) =>
    lanes.flatMap((lane) => {
      const value = entry[lane];
      return 'assertions' in value
        ? value.assertions.map((id) => ({ id, lane }))
        : [];
    }),
  );
}

function evidenceFor(
  rows: readonly ParityRow[],
  status: EvidenceStatus = 'passed',
): ParityEvidenceRecord[] {
  return declarations(rows).map(({ id, lane }) => ({
    lane,
    status,
    title: `@parity:${id} executable parity check`,
    source: `tests/${lane}/${id}.test.ts`,
  }));
}

function runCli(input?: string) {
  return spawnSync(
    process.execPath,
    input === undefined
      ? ['scripts/verify-parity-manifest.ts']
      : ['scripts/verify-parity-manifest.ts', '/dev/stdin'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input,
    },
  );
}

test('@parity:manifest.unique-row-ids rejects a duplicate row ID', () => {
  const rows = validRows();
  rows.push(row('workbook', 'workbook.second'));

  assert.throws(() => verifyManifest(rows), /duplicate row ID "workbook"/);
});

test('@parity:manifest.unique-assertion-ids rejects duplicate assertion evidence', () => {
  const rows = validRows();
  rows[1] = row(correctionIds[0], 'workbook.unit');

  assert.throws(
    () => verifyManifest(rows),
    /assertion "workbook\.unit".*workbook.*correction\.empty-workbook/,
  );
});

test('@parity:manifest.execution-complete rejects missing structured evidence', () => {
  const rows = validRows();
  const evidence = evidenceFor(rows).filter(
    ({ title }) => !title.includes('@parity:correction.printable-cells '),
  );

  assert.throws(
    () => verifyManifest(rows, evidence),
    /correction\.printable-cells.*not executed/,
  );
});

test('@parity:manifest.execution-declared rejects unknown structured evidence', () => {
  const rows = validRows();
  const evidence = evidenceFor(rows);
  evidence.push({
    lane: 'unit',
    status: 'passed',
    title: '@parity:workbook.undeclared unexpected evidence',
    source: 'tests/unit/unknown.test.ts',
  });

  assert.throws(
    () => verifyManifest(rows, evidence),
    /evidence assertion "workbook\.undeclared" is not declared/,
  );
});

test('@parity:manifest.failed-evidence does not cover an expected assertion', () => {
  const rows = validRows();
  const evidence = evidenceFor(rows);
  evidence[evidence.length - 1] = { ...evidence.at(-1)!, status: 'failed' };

  assert.throws(
    () => verifyManifest(rows, evidence),
    /correction\.printable-cells.*no passed evidence.*failed/,
  );
});

test('@parity:manifest.skipped-evidence does not cover an expected assertion', () => {
  const rows = validRows();
  const evidence = evidenceFor(rows);
  evidence[evidence.length - 1] = { ...evidence.at(-1)!, status: 'skipped' };

  assert.throws(
    () => verifyManifest(rows, evidence),
    /correction\.printable-cells.*no passed evidence.*skipped/,
  );
});

test('@parity:manifest.lane-match rejects passed evidence from the wrong lane', () => {
  const rows = validRows();
  const evidence = evidenceFor(rows);
  evidence[0] = { ...evidence[0], lane: 'browser' };

  assert.throws(
    () => verifyManifest(rows, evidence),
    /workbook\.unit.*declared in unit.*reported in browser/,
  );
});

test('@parity:manifest.repeated-evidence accepts repeated passed runs and deduplicates coverage', () => {
  const rows = validRows();
  const evidence = evidenceFor(rows);
  evidence.push({ ...evidence[0], project: 'chromium-repeat' });

  const summary = verifyManifest(rows, evidence);

  assert.equal(summary.assertionCount, evidence.length - 1);
  assert.equal(summary.executedCount, evidence.length - 1);
  assert.equal(summary.evidenceRecordCount, evidence.length);
  assert.equal(summary.passedEvidenceRecordCount, evidence.length);
});

test('@parity:manifest.evidence-shape rejects malformed records, statuses, sources, and titles', () => {
  const rows = validRows();
  const base = evidenceFor(rows);
  const replaced = (record: unknown) => [record, ...base.slice(1)];

  assert.throws(
    () => verifyManifest(rows, replaced('@parity:workbook.unit bare title')),
    /evidence record 1 must be an object/,
  );
  assert.throws(
    () => verifyManifest(rows, replaced({ ...base[0], status: 'running' })),
    /evidence record 1.*invalid status "running"/,
  );
  assert.throws(
    () => verifyManifest(rows, replaced({ ...base[0], source: '   ' })),
    /evidence record 1.*nonempty source/,
  );
  assert.throws(
    () => verifyManifest(rows, replaced({ ...base[0], title: 'prefix@parity:workbook.unit' })),
    /evidence record 1.*exactly one exact @parity:<id> token/,
  );
  assert.throws(
    () => verifyManifest(rows, replaced({ ...base[0], lane: 'integration' })),
    /evidence record 1.*invalid lane "integration"/,
  );
});

test('@parity:manifest.lane-shape rejects lanes with conflicting keys', () => {
  const rows = validRows();
  rows[0] = {
    ...rows[0],
    unit: {
      assertions: ['workbook.unit'],
      notApplicable: 'conflict',
    } as unknown as ParityRow['unit'],
  };

  assert.throws(
    () => verifyManifest(rows),
    /workbook\.unit.*exactly one of assertions or notApplicable/,
  );
});

test('@parity:manifest.row-shape rejects missing and unexpected row properties', () => {
  const missing = validRows();
  delete (missing[0] as unknown as Record<string, unknown>).browser;
  assert.throws(() => verifyManifest(missing), /workbook row is missing property "browser"/);

  const extra = validRows();
  extra[0] = {
    ...extra[0],
    unit: { assertions: [] },
    integration: { assertions: ['workbook.integration'] },
  } as unknown as ParityRow;
  assert.throws(
    () => verifyManifest(extra),
    /workbook row has unexpected property "integration"/,
  );
});

test('@parity:manifest.lane-shape rejects extra lane properties', () => {
  const rows = validRows();
  rows[0] = {
    ...rows[0],
    unit: { assertions: ['workbook.unit'], owner: 'nobody' } as unknown as ParityRow['unit'],
  };

  assert.throws(() => verifyManifest(rows), /workbook\.unit.*unexpected property "owner"/);
});

test('@parity:manifest.ids rejects empty row IDs and malformed assertion IDs', () => {
  const emptyId = validRows();
  emptyId[0] = row('   ', 'workbook.unit');
  assert.throws(() => verifyManifest(emptyId), /row 1 has an empty ID/);

  const malformedAssertion = validRows();
  malformedAssertion[0] = row('workbook', 'workbook has spaces');
  assert.throws(
    () => verifyManifest(malformedAssertion),
    /workbook\.unit assertion "workbook has spaces" is malformed/,
  );
});

test('@parity:manifest.na-explained rejects unexplained N/A lanes', () => {
  const rows = validRows();
  rows[0] = { ...rows[0], visual: { notApplicable: '   ' } };

  assert.throws(
    () => verifyManifest(rows),
    /workbook\.visual.*nonempty notApplicable explanation/,
  );
});

test('@parity:manifest.corrections-required rejects a missing correction row', () => {
  const rows = validRows().filter((entry) => entry.id !== 'correction.resource-cleanup');

  assert.throws(
    () => verifyManifest(rows),
    /mandatory correction row "correction\.resource-cleanup" is missing/,
  );
});

test('@parity:manifest.corrections-executable rejects correction rows without evidence', () => {
  const rows = validRows();
  rows[1] = {
    id: correctionIds[0],
    unit: { assertions: [] },
    component: { notApplicable: 'No component integration is involved.' },
    browser: { notApplicable: 'No browser integration is involved.' },
    visual: { notApplicable: 'The correction has no visible state.' },
  };

  assert.throws(
    () => verifyManifest(rows),
    /correction\.empty-workbook has no executable assertion/,
  );
});

test('@parity:manifest.catalog is complete and uses stable assertion prefixes', () => {
  const expectedRows = [
    'workbook',
    'selection',
    'editing',
    'history',
    'formatting',
    'structure',
    'ranges',
    'view',
    'clipboard',
    'data-tools',
    'formulas',
    'output',
    'input',
    'localization',
    ...correctionIds,
  ];
  const prefixes = new Map([
    ['data-tools', 'tools.'],
    ['localization', 'locale.'],
  ]);

  assert.deepEqual(parityManifest.map(({ id }) => id), expectedRows);
  for (const entry of parityManifest) {
    const prefix = entry.id.startsWith('correction.')
      ? 'correction.'
      : (prefixes.get(entry.id) ?? `${entry.id}.`);
    for (const { id } of declarations([entry])) {
      assert.ok(id.startsWith(prefix), `${entry.id} assertion ${id} must start with ${prefix}`);
    }
  }

  const emptyWorkbook = parityManifest.find(({ id }) => id === 'correction.empty-workbook')!;
  assert.deepEqual(emptyWorkbook.component, {
    assertions: ['correction.empty-workbook-component'],
  });

  const summary = verifyManifest(parityManifest);
  assert.equal(summary.rowCount, expectedRows.length);
  assert.ok(summary.assertionCount >= expectedRows.length);
});

test('@parity:manifest.inputs-readonly does not mutate manifest or structured evidence', () => {
  const rows = validRows();
  const rowsBefore = structuredClone(rows);
  const evidence = evidenceFor(rows);
  const evidenceBefore = structuredClone(evidence);

  verifyManifest(rows, evidence);

  assert.deepEqual(rows, rowsBefore);
  assert.deepEqual(evidence, evidenceBefore);
});

test('@parity:manifest.cli-missing-evidence exits nonzero without an execution artifact', () => {
  const result = runCli();

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing execution artifact/i);
  assert.doesNotMatch(result.stdout, /verified parity manifest/i);
});

test('@parity:manifest.cli-structured accepts complete JSON and NDJSON evidence', () => {
  const evidence = evidenceFor(parityManifest);
  const json = runCli(JSON.stringify(evidence));
  assert.equal(json.status, 0, json.stderr);
  assert.match(json.stdout, /verified parity manifest/i);

  const ndjson = runCli(evidence.map((record) => JSON.stringify(record)).join('\n'));
  assert.equal(ndjson.status, 0, ndjson.stderr);
  assert.match(ndjson.stdout, /verified parity manifest/i);
});

test('@parity:manifest.cli-structured rejects bare, missing, failed, and wrong-lane evidence', () => {
  const complete = evidenceFor(parityManifest);

  const bare = runCli(JSON.stringify(complete.map(({ title }) => title)));
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /evidence record 1 must be an object/);

  const missing = runCli(JSON.stringify(complete.slice(1)));
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /workbook\.canonical-roundtrip.*not executed/);

  const failedRecords = structuredClone(complete);
  failedRecords[0] = { ...failedRecords[0], status: 'failed' };
  const failed = runCli(JSON.stringify(failedRecords));
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /workbook\.canonical-roundtrip.*no passed evidence.*failed/);

  const wrongLaneRecords = structuredClone(complete);
  wrongLaneRecords[0] = { ...wrongLaneRecords[0], lane: 'browser' };
  const wrongLane = runCli(JSON.stringify(wrongLaneRecords));
  assert.equal(wrongLane.status, 1);
  assert.match(wrongLane.stderr, /workbook\.canonical-roundtrip.*declared in unit.*reported in browser/);
});
