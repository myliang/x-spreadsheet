import filterFixture from '../../parity/fixtures/operations/filter.json';
import sortFixture from '../../parity/fixtures/operations/sort.json';
import { describe, expect, it } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import {
  assertFilterResourceLimit,
  filterItems,
  filteredRows,
  setFilter,
} from '../../../src/core/operations/filter';
import { setSort, sortRows, sortValues } from '../../../src/core/operations/sort';
import type { LocaleDefinition } from '../../../src/core/types/changes';
import type { Selection, SheetId } from '../../../src/core/types/coordinates';
import type { SheetData } from '../../../src/core/types/workbook';

const locale: LocaleDefinition = { id: 'en-US', messages: {} };
const filterSheet = filterFixture.sheet as unknown as SheetData;
const sortSheet = sortFixture.sheet as unknown as SheetData;
const selection = (sheet: SheetId): Selection => ({
  sheet,
  range: { start: { row: 0, column: 0 }, end: { row: 3, column: 1 } },
  active: { row: 0, column: 0 },
});

describe('filter and corrected sorting transforms', () => {
  it('computes filter membership and item counts from rendered cell text', () => {
    expect(filterItems(filterSheet, 1, {
      start: { row: 0, column: 0 }, end: { row: 3, column: 1 },
    })).toEqual({ keep: 2, drop: 1 });
    expect(filteredRows(filterSheet)).toEqual([2]);
    expect(filterItems({
      rows: {
        len: 4,
        1: { cells: { 0: { text: '   ' } } },
        2: { cells: { 0: { text: '__proto__' } } },
        3: { cells: { 0: { text: '__proto__' } } },
      },
    }, 0, {
      start: { row: 0, column: 0 }, end: { row: 3, column: 0 },
    })).toEqual(JSON.parse('{"":1,"__proto__":2}'));
  });

  it('compiles in-filter candidates once without Array.includes and preserves extensions', () => {
    const candidates = ['keep'];
    candidates.includes = () => {
      throw new Error('candidate membership must use Set.has');
    };
    const sheet: SheetData = {
      vendorSheet: true,
      rows: {
        len: 3,
        1: { cells: { 0: { text: 'keep' } } },
        2: { cells: { 0: { text: 'drop' } } },
      },
      cols: { len: 2 },
      autofilter: {
        ref: 'A1:B3', vendorAuto: 1,
        filters: [{ ci: 0, operator: 'in', value: candidates, vendorFilter: 'keep' }],
      },
    };
    expect(filteredRows(sheet)).toEqual([2]);
    const extensionSheet = {
      ...sheet,
      autofilter: {
        ...sheet.autofilter,
        filters: [{ ci: 0, operator: 'in', value: ['keep'], vendorFilter: 'keep' }],
      },
    } as unknown as SheetData;
    const next = setFilter(extensionSheet, {
      start: { row: 0, column: 0 }, end: { row: 2, column: 1 },
    }, { column: 0, operator: 'all', value: [] });
    expect(next).toMatchObject({
      vendorSheet: true,
      autofilter: {
        ref: 'A1:B3', vendorAuto: 1,
        filters: [{ ci: 0, operator: 'all', value: [], vendorFilter: 'keep' }],
      },
    });
  });

  it('@parity:tools.sort-total-order keeps empties last descending with stable ties', () => {
    expect(sortValues(['10', 'A', '', '2'], 'desc', locale)).toEqual(['10', '2', 'A', '']);
    expect(sortValues(['2', 2, '02', true, 'TRUE', null, undefined], 'asc', locale))
      .toEqual(['2', 2, '02', true, 'TRUE', null, undefined]);
  });

  it('@parity:correction.sort-rendered-values sorts selected-column rendered values, not row indexes', () => {
    expect(sortRows(sortSheet, 1, 'asc', locale, {
      start: { row: 0, column: 0 }, end: { row: 3, column: 1 },
    })).toEqual([2, 3, 1]);
    expect(sortRows({
      rows: {
        len: 5,
        0: { cells: { 0: { text: 'name' } } },
        1: { cells: { 0: { text: '=2+8' } } },
        2: { cells: { 0: { text: '2' } } },
        3: { cells: { 0: { text: 'A' } } },
        4: { cells: { 0: { text: '' } } },
      },
    }, 0, 'desc', locale, {
      start: { row: 0, column: 0 }, end: { row: 4, column: 0 },
    })).toEqual([1, 2, 3, 4]);
  });

  it('persists set/clear filter and sort commands with one deterministic history entry each', () => {
    const controller = new WorkbookController(filterSheet);
    const sheet = controller.getSheetIds()[0]!;
    const selected = selection(sheet);

    expect(controller.dispatch({
      type: 'set-filter', selection: selected,
      filter: { column: 1, operator: 'in', value: ['drop'] },
    }, 'toolbar')).toMatchObject({ status: 'committed', commit: { change: { kind: 'filter' } } });
    expect(controller.dispatch({
      type: 'set-filter', selection: selected,
      filter: { column: 1, operator: 'in', value: ['drop'] },
    }, 'toolbar')).toEqual({ status: 'noop' });
    expect(controller.dispatch({ type: 'sort', sheet, column: 1, order: 'desc' }, 'toolbar').status)
      .toBe('committed');
    expect(controller.getValue()[0]!.autofilter).toMatchObject({
      ref: 'A1:B4',
      filters: [{ ci: 1, operator: 'in', value: ['drop'] }],
      sort: { ci: 1, order: 'desc' },
    });
    expect(controller.dispatch({ type: 'clear-filter', sheet }, 'toolbar').status).toBe('committed');
    expect(controller.getValue()[0]!.autofilter).toEqual({});
    expect(controller.historySize.undo).toBe(3);
  });

  it('rejects 250001-row filter and sort workloads before allocation or controller mutation', () => {
    const hugeRange = {
      start: { row: 0, column: 0 }, end: { row: 250_001, column: 0 },
    };
    const hugeSheet: SheetData = {
      rows: { len: 250_002 }, cols: { len: 1 },
      autofilter: { ref: 'A1:A250002', filters: [], sort: null },
    };
    expect(() => filterItems(hugeSheet, 0, hugeRange)).toThrow(RangeError);
    expect(() => filteredRows({
      rows: { len: 250_002 }, cols: { len: 1 },
      autofilter: { ref: 'A1:A250002', filters: [{ ci: 0, operator: 'all', value: [] }] },
    })).toThrow(RangeError);
    expect(() => sortRows(hugeSheet, 0, 'asc', locale, hugeRange)).toThrow(RangeError);

    const controller = new WorkbookController(hugeSheet);
    const sheet = controller.getSheetIds()[0]!;
    const before = controller.getValue();
    expect(() => controller.dispatch({
      type: 'set-filter',
      selection: { sheet, range: hugeRange, active: hugeRange.start },
      filter: { column: 0, operator: 'all', value: [] },
    }, 'toolbar')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(() => controller.dispatch({ type: 'sort', sheet, column: 0, order: 'asc' }, 'toolbar'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize.undo).toBe(0);
  });

  it('budgets candidate-set construction before pure or controller filter work', () => {
    const boundaryRange = {
      start: { row: 0, column: 0 }, end: { row: 125_000, column: 0 },
    };
    expect(() => assertFilterResourceLimit(boundaryRange, [{
      ci: 0, operator: 'in', value: Array<string>(125_000).fill('keep'),
    }])).not.toThrow();
    expect(() => assertFilterResourceLimit(boundaryRange, [{
      ci: 0, operator: 'in', value: Array<string>(125_001).fill('keep'),
    }])).toThrow(RangeError);

    const values = Array<string>(250_000).fill('keep');
    const range = { start: { row: 0, column: 0 }, end: { row: 250_000, column: 0 } };
    const filter = { ci: 0, operator: 'in' as const, value: values };
    expect(() => assertFilterResourceLimit(range, [filter])).toThrow(RangeError);
    const hugeSheet: SheetData = {
      rows: { len: 250_001 }, cols: { len: 1 },
      autofilter: { ref: 'A1:A250001', filters: [filter], sort: null },
    };
    expect(() => filteredRows(hugeSheet)).toThrow(RangeError);

    const controller = new WorkbookController({ rows: { len: 250_001 }, cols: { len: 1 } });
    const sheet = controller.getSheetIds()[0]!;
    const before = controller.getValue();
    expect(() => controller.dispatch({
      type: 'set-filter', selection: { sheet, range, active: range.start },
      filter: { column: 0, operator: 'in', value: values },
    }, 'toolbar')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize.undo).toBe(0);
  });

  it('shares one formula-reference budget across every sort key and rejects before mutation', () => {
    const hugeFormulaSheet: SheetData = {
      rows: {
        len: 3,
        1: { cells: { 1: { text: '=SUM(A1:A300001)' } } },
        2: { cells: { 1: { text: '1' } } },
      },
      cols: { len: 2 },
      autofilter: { ref: 'A1:B3', filters: [], sort: null },
    };
    const range = { start: { row: 0, column: 0 }, end: { row: 2, column: 1 } };
    expect(() => sortRows(hugeFormulaSheet, 1, 'asc', locale, range)).toThrow(RangeError);
    expect(() => setSort(hugeFormulaSheet, 1, 'asc')).toThrow(RangeError);

    const controller = new WorkbookController(hugeFormulaSheet);
    const sheet = controller.getSheetIds()[0]!;
    const before = controller.getValue();
    expect(() => controller.dispatch({ type: 'sort', sheet, column: 1, order: 'asc' }, 'toolbar'))
      .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize.undo).toBe(0);

    const sharedDependency: SheetData = {
      rows: {
        len: 3,
        0: { cells: { 2: { text: '=SUM(B1:B125000)' } } },
        1: { cells: { 0: { text: '=C1' } } },
        2: { cells: { 0: { text: '=C1' } } },
      },
      cols: { len: 3 },
      autofilter: { ref: 'A1:A3', filters: [], sort: null },
    };
    expect(() => sortRows(sharedDependency, 0, 'asc', locale, {
      start: { row: 0, column: 0 }, end: { row: 2, column: 0 },
    })).toThrow(RangeError);
  });

  it('keeps cycles and ordinary parse errors as rendered sort values, not budget failures', () => {
    const sheet: SheetData = {
      rows: {
        len: 4,
        1: { cells: { 0: { text: '=A3' } } },
        2: { cells: { 0: { text: '=A2' } } },
        3: { cells: { 0: { text: '=SUM(' } } },
      },
      cols: { len: 1 },
      autofilter: { ref: 'A1:A4', filters: [], sort: null },
    };
    expect(sortRows(sheet, 0, 'asc', locale)).toEqual([1, 2, 3]);
    expect(setSort(sheet, 0, 'asc')).not.toBe(sheet);
  });
});
