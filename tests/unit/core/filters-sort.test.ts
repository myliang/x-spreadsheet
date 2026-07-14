import filterFixture from '../../parity/fixtures/operations/filter.json';
import sortFixture from '../../parity/fixtures/operations/sort.json';
import { describe, expect, it } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import { filterItems, filteredRows } from '../../../src/core/operations/filter';
import { sortRows, sortValues } from '../../../src/core/operations/sort';
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
});
