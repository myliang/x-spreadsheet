import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  extractParityEvidence,
  verifyManifest,
} from '../../scripts/verify-parity-manifest.ts';
import { parityManifest } from './manifest.ts';
import type { ParityRow } from './manifest-types.ts';

test('@parity:manifest.all-rows-covered rejects an uncovered row', () => {
  assert.throws(
    () => verifyManifest([{ id: 'workbook', unit: { assertions: [] } }], new Set()),
    /workbook has no executable assertion/,
  );
});

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

function declaredIds(rows: readonly ParityRow[]): Set<string> {
  return new Set(
    rows.flatMap((entry) =>
      ['unit', 'component', 'browser', 'visual'].flatMap((lane) => {
        const value = entry[lane as keyof Pick<ParityRow, 'unit' | 'component' | 'browser' | 'visual'>];
        return 'assertions' in value ? [...value.assertions] : [];
      }),
    ),
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

test('@parity:manifest.execution-complete rejects missing executed IDs', () => {
  const rows = validRows();
  const executed = declaredIds(rows);
  executed.delete('correction.printable-cells');

  assert.throws(
    () => verifyManifest(rows, executed),
    /correction\.printable-cells.*not executed/,
  );
});

test('@parity:manifest.execution-declared rejects unknown executed IDs', () => {
  const rows = validRows();
  const executed = declaredIds(rows);
  executed.add('workbook.undeclared');

  assert.throws(
    () => verifyManifest(rows, executed),
    /executed assertion "workbook\.undeclared" is not declared/,
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

test('@parity:manifest.lane-shape rejects missing and extra lane properties', () => {
  const missing = validRows();
  delete (missing[0] as unknown as Record<string, unknown>).browser;
  assert.throws(() => verifyManifest(missing), /workbook\.browser.*valid lane object/);

  const extra = validRows();
  extra[0] = {
    ...extra[0],
    unit: { assertions: ['workbook.unit'], owner: 'nobody' } as unknown as ParityRow['unit'],
  };
  assert.throws(() => verifyManifest(extra), /workbook\.unit.*unexpected property "owner"/);
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
    for (const assertionId of declaredIds([entry])) {
      assert.ok(
        assertionId.startsWith(prefix),
        `${entry.id} assertion ${assertionId} must start with ${prefix}`,
      );
    }
  }

  const summary = verifyManifest(parityManifest);
  assert.equal(summary.rowCount, expectedRows.length);
  assert.ok(summary.assertionCount >= expectedRows.length);
});

test('@parity:manifest.inputs-readonly does not mutate manifest or evidence inputs', () => {
  const rows = validRows();
  const before = structuredClone(rows);
  const executed = declaredIds(rows);
  const executedBefore = [...executed];

  verifyManifest(rows, executed);

  assert.deepEqual(rows, before);
  assert.deepEqual([...executed], executedBefore);
});

test('@parity:manifest.evidence-tokens extracts exact evidence IDs', () => {
  assert.deepEqual(
    [...extractParityEvidence([
      '@parity:workbook.roundtrip preserves sparse data',
      'drag behavior @parity:selection.drag-range',
    ])],
    ['workbook.roundtrip', 'selection.drag-range'],
  );
});

test('@parity:manifest.evidence-tokens rejects malformed and duplicate evidence', () => {
  assert.throws(
    () => extractParityEvidence(['prefix@parity:workbook.roundtrip']),
    /does not contain exactly one exact @parity:<id> token/,
  );
  assert.throws(
    () => extractParityEvidence([
      '@parity:workbook.roundtrip first',
      'second @parity:workbook.roundtrip',
    ]),
    /duplicate evidence ID "workbook\.roundtrip"/,
  );
});

test('@parity:manifest.cli-missing-evidence exits nonzero without an execution artifact', () => {
  const result = spawnSync(process.execPath, ['scripts/verify-parity-manifest.ts'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing execution artifact/i);
  assert.doesNotMatch(result.stdout, /verified parity manifest/i);
});
