import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canonicalizeWorkbook,
  parseWorkbook,
  semanticEqual,
  serializeWorkbook,
} from '../../../src/core';
import { TegoSheetException } from '../../../src/index';
import type { WorkbookInput } from '../../../src/core';

interface WorkbookFixture {
  readonly id: string;
  readonly input: WorkbookInput;
  readonly legacyOutput: WorkbookInput;
}

const fixtureIds = [
  'autofilter',
  'blank-object',
  'cells',
  'columns',
  'empty-array',
  'multiple-sheets',
  'rows',
  'sheet-fields',
  'sparse-falsy',
  'styles',
  'validations',
] as const;

function loadFixture(id: (typeof fixtureIds)[number]): WorkbookFixture {
  const path = fileURLToPath(
    new URL(`../../parity/fixtures/workbooks/${id}.json`, import.meta.url),
  );

  return JSON.parse(readFileSync(path, 'utf8')) as WorkbookFixture;
}

describe('workbook parsing and serialization', () => {
  it.each(fixtureIds)(
    '@parity:workbook.canonical-roundtrip matches the exact %s fixture without mutation',
    id => {
      const fixture = loadFixture(id);
      const before = structuredClone(fixture.input);

      const parsed = parseWorkbook(fixture.input);
      const serialized = serializeWorkbook(parsed);

      expect(serialized).toEqual(fixture.legacyOutput);
      expect(fixture.input).toEqual(before);
      expect(serialized).not.toBe(parsed);
      serialized.forEach((sheet, index) => expect(sheet).not.toBe(parsed[index]));
    },
  );

  it('@parity:workbook.empty-input distinguishes a blank sheet from an empty workbook', () => {
    expect(parseWorkbook({})).toEqual([
      {
        name: 'sheet1',
        freeze: 'A1',
        styles: [],
        merges: [],
        rows: { len: 100 },
        cols: { len: 26 },
        validations: [],
        autofilter: {},
      },
    ]);
    expect(parseWorkbook([])).toEqual([]);
  });

  it('normalizes A1 strings and sparse decimal keys while preserving recursive extensions', () => {
    const input = {
      name: '',
      freeze: 'c3',
      merges: ['a1:b2'],
      rows: {
        len: 4,
        '01': {
          cells: {
            '002': {
              text: '',
              value: 0,
              editable: false,
              vendorCell: { nested: [false, 0, '', null] },
            },
            vendorCells: { enabled: false },
          },
          vendorRow: ['kept'],
        },
        vendorRows: { source: 'legacy' },
      },
      cols: { len: 3, '02': { width: 0, hide: false, vendorColumn: 0 } },
      validations: [{ refs: ['a1:a3'], vendorValidation: '' }],
      autofilter: {
        ref: 'a1:c4',
        filters: [{ ci: 0, operator: 'in', value: [], vendorFilter: false }],
        sort: { ci: 0, order: 'asc', vendorSort: null },
        vendorAutofilter: { active: false },
      },
      vendorSheet: { nested: { falsy: false } },
    } satisfies WorkbookInput;

    expect(parseWorkbook(input)).toEqual([
      {
        name: '',
        freeze: 'C3',
        styles: [],
        merges: ['A1:B2'],
        rows: {
          len: 4,
          '1': {
            cells: {
              '2': {
                text: '',
                value: 0,
                editable: false,
                vendorCell: { nested: [false, 0, '', null] },
              },
              vendorCells: { enabled: false },
            },
            vendorRow: ['kept'],
          },
          vendorRows: { source: 'legacy' },
        },
        cols: {
          len: 3,
          '2': { width: 0, hide: false, vendorColumn: 0 },
        },
        validations: [{ refs: ['A1:A3'], vendorValidation: '' }],
        autofilter: {
          ref: 'A1:C4',
          filters: [{ ci: 0, operator: 'in', value: [], vendorFilter: false }],
          sort: { ci: 0, order: 'asc', vendorSort: null },
          vendorAutofilter: { active: false },
        },
        vendorSheet: { nested: { falsy: false } },
      },
    ]);
  });

  it('clones at ingress and egress so later mutations cannot cross the boundary', () => {
    const input = { rows: { 0: { cells: { 0: { text: 'original' } } } } };
    const parsed = parseWorkbook(input);
    const firstOutput = serializeWorkbook(parsed);

    (input.rows[0].cells[0] as { text: string }).text = 'changed input';
    (firstOutput[0]?.rows?.[0] as { cells: { 0: { text: string } } }).cells[0].text =
      'changed output';

    expect(serializeWorkbook(parsed)[0]?.rows?.[0]).toEqual({
      cells: { 0: { text: 'original' } },
    });
  });

  it.each([
    null,
    'sheet',
    1,
    [null],
    { rows: [] },
    { rows: { len: -1 } },
    { rows: { 0: 'not a row' } },
    { rows: { 0: { cells: { 0: { text: 3 } } } } },
    { cols: { 0: { width: Number.POSITIVE_INFINITY } } },
    { styles: [{ font: { size: Number.NaN } }] },
    { validations: [{ refs: 'A1' }] },
    { vendor: undefined },
    { vendor: Array(1) },
    Array(1),
    { [Symbol('not-json')]: true },
  ])('rejects invalid workbook input atomically: %o', invalid => {
    let exposed: unknown = 'unchanged';

    try {
      exposed = parseWorkbook(invalid as never);
    } catch (error) {
      expect(error).toBeInstanceOf(TegoSheetException);
      expect(error).toMatchObject({
        code: 'INVALID_DATA',
        message: 'Workbook data is invalid',
        error: { code: 'INVALID_DATA', recoverable: false },
      });
    }

    expect(exposed).toBe('unchanged');
  });

  it('rejects sparse-key collisions after leading-zero normalization', () => {
    expect(() =>
      parseWorkbook({ rows: { 1: { cells: {} }, '01': { cells: {} } } }),
    ).toThrowError(TegoSheetException);
  });

  it('canonicalizes deterministically and compares semantic content independent of object order', () => {
    const left = {
      vendor: { b: 2, a: 1 },
      rows: { 2: { cells: { 3: { text: 'x' } } }, len: 5 },
    };
    const right = {
      rows: { len: 5, 2: { cells: { 3: { text: 'x' } } } },
      vendor: { a: 1, b: 2 },
    };

    expect(semanticEqual(left, right)).toBe(true);
    expect(JSON.stringify(canonicalizeWorkbook(left))).toBe(
      JSON.stringify(canonicalizeWorkbook(right)),
    );
    expect(semanticEqual(left, [{ ...right, name: 'different' }])).toBe(false);
    expect(semanticEqual([{ name: 'A' }, { name: 'B' }], [{ name: 'B' }, { name: 'A' }])).toBe(
      false,
    );
  });
});
