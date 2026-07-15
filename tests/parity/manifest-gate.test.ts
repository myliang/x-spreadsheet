import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import {
  runParityCli,
  verifyManifest,
  type ManifestVerificationSummary,
} from '../../scripts/verify-parity-manifest.ts';
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
type CatalogLane = readonly string[] | null;
interface CatalogRow {
  readonly id: string;
  readonly unit: CatalogLane;
  readonly component: CatalogLane;
  readonly browser: CatalogLane;
  readonly visual: CatalogLane;
}

const expectedCatalog: readonly CatalogRow[] = [
  {
    id: 'workbook',
    unit: ['workbook.canonical-roundtrip', 'workbook.empty-input'],
    component: ['workbook.sheet-lifecycle'],
    browser: ['workbook.import-export'],
    visual: ['workbook.initial-grid'],
  },
  {
    id: 'selection',
    unit: ['selection.normalize-range'],
    component: ['selection.keyboard-extension'],
    browser: ['selection.pointer-drag'],
    visual: ['selection.active-range'],
  },
  {
    id: 'editing',
    unit: ['editing.commit-cancel'],
    component: ['editing.inline-editor'],
    browser: ['editing.ime-input'],
    visual: ['editing.editor-overlay'],
  },
  {
    id: 'history',
    unit: ['history.undo-redo'],
    component: ['history.command-controls'],
    browser: ['history.shortcuts'],
    visual: null,
  },
  {
    id: 'formatting',
    unit: ['formatting.commands'],
    component: ['formatting.toolbar'],
    browser: ['formatting.shortcuts'],
    visual: ['formatting.styled-cells'],
  },
  {
    id: 'structure',
    unit: ['structure.row-column-operations'],
    component: ['structure.sheet-tabs'],
    browser: ['structure.resize-drag'],
    visual: ['structure.hidden-resized-grid'],
  },
  {
    id: 'ranges',
    unit: ['ranges.merge-autofill'],
    component: ['ranges.selection-anchor'],
    browser: ['ranges.drag-fill'],
    visual: ['ranges.merged-selection'],
  },
  {
    id: 'view',
    unit: ['view.frozen-geometry'],
    component: ['view.scroll-sync'],
    browser: ['view.zoom-scroll', 'view.render-recovery'],
    visual: ['view.frozen-panes'],
  },
  {
    id: 'clipboard',
    unit: ['clipboard.transform'],
    component: ['clipboard.menu-actions'],
    browser: ['clipboard.system-bridge'],
    visual: null,
  },
  {
    id: 'data-tools',
    unit: ['tools.sort-total-order', 'tools.validation-all-sheets'],
    component: ['tools.filter-controls'],
    browser: ['tools.filter-menu'],
    visual: ['tools.filtered-grid'],
  },
  {
    id: 'formulas',
    unit: ['formulas.references', 'formulas.computation'],
    component: ['formulas.editor-display'],
    browser: ['formulas.keyboard-commit'],
    visual: null,
  },
  {
    id: 'output',
    unit: ['output.print-layout'],
    component: ['output.print-dialog'],
    browser: ['output.export-download'],
    visual: ['output.print-preview'],
  },
  {
    id: 'input',
    unit: ['input.keymap'],
    component: ['input.desktop-editing'],
    browser: ['input.touch-gestures'],
    visual: ['input.touch-handles'],
  },
  {
    id: 'localization',
    unit: ['locale.message-resolution'],
    component: ['locale.switch-language'],
    browser: ['locale.browser-default'],
    visual: ['locale.localized-ui'],
  },
  {
    id: 'correction.empty-workbook',
    unit: ['correction.empty-workbook'],
    component: ['correction.empty-workbook-component'],
    browser: null,
    visual: null,
  },
  {
    id: 'correction.validation-all-sheets',
    unit: ['correction.validation-all-sheets'],
    component: null,
    browser: null,
    visual: null,
  },
  {
    id: 'correction.sort-rendered-values',
    unit: ['correction.sort-rendered-values'],
    component: null,
    browser: null,
    visual: null,
  },
  {
    id: 'correction.resource-cleanup',
    unit: null,
    component: null,
    browser: ['correction.resource-cleanup'],
    visual: null,
  },
  {
    id: 'correction.printable-cells',
    unit: ['correction.printable-cells'],
    component: null,
    browser: null,
    visual: ['correction.printable-cells-visual'],
  },
];
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

function browserRow(id: string, assertionId: string): ParityRow {
  return {
    id,
    unit: { notApplicable: 'Covered in the browser matrix.' },
    component: { notApplicable: 'Covered in the browser matrix.' },
    browser: { assertions: [assertionId] },
    visual: { notApplicable: 'No visual evidence is involved.' },
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
): Array<Omit<ParityEvidenceRecord, 'runId' | 'revision' | 'treeHash' | 'manifestHash' | 'runner' | 'configHash' | 'startedAt' | 'observedAt'>> {
  return declarations(rows).map(({ id, lane }) => ({
    lane,
    status,
    title: `@parity:${id} executable parity check`,
    source: `tests/${lane}/${id}.test.ts`,
  }));
}

const releaseContext = {
  schemaVersion: 1,
  runId: '11111111-1111-4111-8111-111111111111',
  revision: '0123456789012345678901234567890123456789',
  treeHash: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
  manifestHash: 'manifest-hash',
  startedAt: '2026-07-16T00:00:00.000Z',
  expiresAt: '2026-07-16T02:00:00.000Z',
  lanes: {
    unit: {
      runner: 'vitest@4.1.10',
      configHash: 'unit-config-hash',
      expectedProjects: ['unit'],
      allowedProjectSkips: {},
    },
    component: {
      runner: 'vitest@4.1.10',
      configHash: 'component-config-hash',
      expectedProjects: ['component'],
      allowedProjectSkips: {},
    },
    browser: {
      runner: 'playwright@1.61.1',
      configHash: 'browser-config-hash',
      expectedProjects: ['chromium-desktop', 'firefox-desktop', 'chromium-touch'],
      allowedProjectSkips: {
        'input.touch-gestures': ['chromium-desktop', 'firefox-desktop'],
      },
    },
    visual: {
      runner: 'playwright@1.61.1',
      configHash: 'visual-config-hash',
      expectedProjects: ['desktop-dpr1'],
      allowedProjectSkips: {},
    },
  },
} as const;

type VerifyWithContext = (
  rows: readonly unknown[],
  evidence: unknown,
  context: typeof releaseContext,
) => ManifestVerificationSummary;

const verifyWithContext = verifyManifest as unknown as VerifyWithContext;

function provenEvidenceFor(rows: readonly ParityRow[]): Array<Record<string, unknown>> {
  return evidenceFor(rows).flatMap(record => {
    const lane = releaseContext.lanes[record.lane];
    return lane.expectedProjects.map(project => ({
      ...record,
      runId: releaseContext.runId,
      revision: releaseContext.revision,
      treeHash: releaseContext.treeHash,
      manifestHash: releaseContext.manifestHash,
      runner: lane.runner,
      configHash: lane.configHash,
      startedAt: releaseContext.startedAt,
      observedAt: '2026-07-16T00:30:00.000Z',
      project,
    }));
  });
}

test('@parity:manifest.provenance-required rejects synthetic records without release identity', () => {
  assert.throws(
    () => verifyWithContext(validRows(), evidenceFor(validRows()), releaseContext),
    /missing property "runId"/,
  );
});

test('@parity:manifest.single-run rejects evidence copied from another release invocation', () => {
  const evidence = provenEvidenceFor(validRows());
  evidence[0] = { ...evidence[0], runId: '22222222-2222-4222-8222-222222222222' };
  assert.throws(
    () => verifyWithContext(validRows(), evidence, releaseContext),
    /same release run.*22222222-2222-4222-8222-222222222222/i,
  );
});

test('@parity:manifest.revision-bound rejects evidence from another revision or tree', () => {
  for (const property of ['revision', 'treeHash'] as const) {
    const evidence = provenEvidenceFor(validRows());
    evidence[0] = { ...evidence[0], [property]: 'ffffffffffffffffffffffffffffffffffffffff' };
    assert.throws(
      () => verifyWithContext(validRows(), evidence, releaseContext),
      new RegExp(`${property}.*current release`, 'i'),
    );
  }
});

test('@parity:manifest.project-matrix rejects missing and unexpected browser projects', () => {
  const rows = validRows();
  rows[0] = browserRow('workbook', 'workbook.browser');
  const missing = provenEvidenceFor(rows).filter(record => (
    record.title !== '@parity:workbook.browser executable parity check'
    || record.project !== 'firefox-desktop'
  ));
  assert.throws(
    () => verifyWithContext(rows, missing, releaseContext),
    /workbook\.browser.*missing project.*firefox-desktop/i,
  );

  const unexpected = provenEvidenceFor(rows);
  unexpected.push({ ...unexpected.find(record => record.title === '@parity:workbook.browser executable parity check')!, project: 'synthetic-browser' });
  assert.throws(
    () => verifyWithContext(rows, unexpected, releaseContext),
    /unexpected project.*synthetic-browser/i,
  );
});

test('@parity:manifest.project-skips allows only explicitly catalogued project skips', () => {
  const rows = validRows();
  rows[0] = browserRow('workbook', 'input.touch-gestures');
  const allowed = provenEvidenceFor(rows).map(record => (
    record.title === '@parity:input.touch-gestures executable parity check'
      && String(record.project).endsWith('-desktop')
      ? { ...record, status: 'skipped' }
      : record
  ));
  assert.doesNotThrow(() => verifyWithContext(rows, allowed, releaseContext));

  const disallowed = allowed.map(record => (
    record.title === '@parity:correction.empty-workbook executable parity check'
      ? { ...record, status: 'skipped' }
      : record
  ));
  assert.throws(
    () => verifyWithContext(rows, disallowed, releaseContext),
    /correction\.empty-workbook.*skip.*not allowed/i,
  );
});

function runCliPaths(paths: readonly string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = runParityCli(paths, {
    log: message => stdout.push(message),
    error: message => stderr.push(message),
  });
  return {
    status,
    stdout: stdout.length === 0 ? '' : `${stdout.join('\n')}\n`,
    stderr: stderr.length === 0 ? '' : `${stderr.join('\n')}\n`,
  };
}

function runCli(input?: string) {
  if (input === undefined) {
    return runCliPaths([]);
  }

  const directory = mkdtempSync(join(tmpdir(), 'parity-manifest-'));
  const artifact = join(directory, 'evidence.json');
  try {
    writeFileSync(artifact, input, 'utf8');
    return runCliPaths([artifact]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function projectCatalog(rows: readonly ParityRow[]): CatalogRow[] {
  return rows.map((row) => ({
    id: row.id,
    ...Object.fromEntries(
      lanes.map((lane) => [
        lane,
        'assertions' in row[lane] ? [...row[lane].assertions] : null,
      ]),
    ),
  })) as CatalogRow[];
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

test('@parity:manifest.mixed-failed rejects a failed record alongside a passed repeat', () => {
  const rows = validRows();
  const evidence = evidenceFor(rows);
  evidence[0] = { ...evidence[0], project: 'chromium' };
  evidence.push({
    ...evidence[0],
    status: 'failed',
    source: 'tests/unit/workbook.table-case-2.test.ts',
    project: 'firefox',
  });

  assert.throws(
    () => verifyManifest(rows, evidence),
    /workbook\.unit.*mixed terminal outcomes.*passed.*chromium.*failed.*table-case-2.*firefox/,
  );
});

test('@parity:manifest.mixed-skipped rejects a skipped record alongside a passed repeat', () => {
  const rows = validRows();
  const evidence = evidenceFor(rows);
  evidence[0] = { ...evidence[0], project: 'webkit' };
  evidence.push({
    ...evidence[0],
    status: 'skipped',
    source: 'tests/unit/workbook.table-case-3.test.ts',
    project: 'mobile-safari',
  });

  assert.throws(
    () => verifyManifest(rows, evidence),
    /workbook\.unit.*mixed terminal outcomes.*passed.*webkit.*skipped.*table-case-3.*mobile-safari/,
  );
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

test('@parity:manifest.lane-shape validates exact lanes before row coverage', () => {
  const emptyAssertions = validRows();
  emptyAssertions[0] = { ...emptyAssertions[0], unit: { assertions: [] } };
  assert.throws(
    () => verifyManifest(emptyAssertions),
    /workbook\.unit assertions must be a nonempty array/,
  );

  const conflictingEmptyLane = validRows();
  conflictingEmptyLane[0] = {
    ...conflictingEmptyLane[0],
    unit: {
      assertions: [],
      notApplicable: 'conflicting empty lane',
    } as unknown as ParityRow['unit'],
  };
  assert.throws(
    () => verifyManifest(conflictingEmptyLane),
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
    unit: { notApplicable: 'No unit evidence was declared for this invalid correction row.' },
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

  const projection = projectCatalog(parityManifest);
  assert.deepEqual(projection, expectedCatalog);
  assert.equal(projection.length, 19);
  assert.equal(
    projection.flatMap((row) => lanes.flatMap((lane) => row[lane] ?? [])).length,
    64,
  );
  assert.equal(
    projection.flatMap((row) => lanes.map((lane) => row[lane])).filter((lane) => lane === null)
      .length,
    16,
  );
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

test('@parity:manifest.evidence-controls rejects control characters in trace metadata', () => {
  const rows = validRows();
  const sourceControl = evidenceFor(rows);
  sourceControl[0] = { ...sourceControl[0], source: 'tests/unit/workbook.test.ts\nforged-line' };
  assert.throws(
    () => verifyManifest(rows, sourceControl),
    /evidence record 1 source must not contain control characters/,
  );

  const projectControl = evidenceFor(rows);
  projectControl[0] = { ...projectControl[0], project: '\u001b[31mforged-project' };
  assert.throws(
    () => verifyManifest(rows, projectControl),
    /evidence record 1 project must not contain control characters/,
  );
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

  const mixedFailedRecords = structuredClone(complete);
  mixedFailedRecords[0] = { ...mixedFailedRecords[0], project: 'chromium' };
  mixedFailedRecords.push({
    ...mixedFailedRecords[0],
    status: 'failed',
    source: 'tests/unit/workbook.case-2.test.ts',
    project: 'firefox',
  });
  const mixedFailed = runCli(JSON.stringify(mixedFailedRecords));
  assert.equal(mixedFailed.status, 1);
  assert.match(
    mixedFailed.stderr,
    /workbook\.canonical-roundtrip.*mixed terminal outcomes.*passed.*chromium.*failed.*case-2.*firefox/,
  );

  const mixedSkippedRecords = structuredClone(complete);
  mixedSkippedRecords[0] = { ...mixedSkippedRecords[0], project: 'webkit' };
  mixedSkippedRecords.push({
    ...mixedSkippedRecords[0],
    status: 'skipped',
    source: 'tests/unit/workbook.case-3.test.ts',
    project: 'mobile-safari',
  });
  const mixedSkipped = runCli(JSON.stringify(mixedSkippedRecords));
  assert.equal(mixedSkipped.status, 1);
  assert.match(
    mixedSkipped.stderr,
    /workbook\.canonical-roundtrip.*mixed terminal outcomes.*passed.*webkit.*skipped.*case-3.*mobile-safari/,
  );
});

test('@parity:manifest.cli-artifact-errors include malformed and unreadable artifact paths', () => {
  const malformed = runCli('[{"lane":');
  assert.equal(malformed.status, 1);
  assert.match(
    malformed.stderr,
    /execution artifact ".*evidence\.json" has invalid JSON:/,
  );

  const directory = mkdtempSync(join(tmpdir(), 'parity-manifest-missing-'));
  const missingPath = join(directory, 'missing-evidence.json');
  rmSync(directory, { recursive: true, force: true });
  const missing = runCliPaths([missingPath]);
  assert.equal(missing.status, 1);
  assert.match(
    missing.stderr,
    /could not read execution artifact ".*missing-evidence\.json":/,
  );

  const unreadableDirectory = mkdtempSync(join(tmpdir(), 'parity-manifest-directory-'));
  try {
    const unreadable = runCliPaths([unreadableDirectory]);
    assert.equal(unreadable.status, 1);
    assert.match(
      unreadable.stderr,
      /could not read execution artifact ".*parity-manifest-directory-.*":/,
    );
  } finally {
    rmSync(unreadableDirectory, { recursive: true, force: true });
  }
});
