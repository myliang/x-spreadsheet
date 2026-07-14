import mergeFixture from '../../parity/fixtures/operations/merge.json';
import { describe, expect, it, vi } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import { autofillText } from '../../../src/core/operations/autofill';
import type { CellRange, Selection, SheetId } from '../../../src/core/types/coordinates';

const selection = (sheet: SheetId, range: CellRange): Selection => ({
  sheet,
  range,
  active: range.start,
});

describe('merge range operations', () => {
  it('@parity:ranges.merge-autofill matches captured merge and unmerge values', () => {
    const controller = new WorkbookController(mergeFixture.before);
    const sheet = controller.getSheetIds()[0]!;
    const selected = selection(sheet, {
      start: { row: 0, column: 0 }, end: { row: 1, column: 1 },
    });

    const merged = controller.dispatch({ type: 'merge', selection: selected }, 'toolbar');
    expect(controller.getValue()[0]).toEqual(mergeFixture.merged);
    expect(merged).toMatchObject({
      status: 'committed',
      commit: { change: { kind: 'merge', source: 'toolbar', sheet, range: selected.range } },
    });

    const unmerged = controller.dispatch({ type: 'unmerge', selection: selected }, 'toolbar');
    expect(controller.getValue()[0]).toEqual(mergeFixture.afterUnmerge);
    expect(unmerged).toMatchObject({ status: 'committed', commit: { change: { kind: 'merge' } } });
  });

  it('rejects overlapping merge atomically and keeps one history/event per success', () => {
    const controller = new WorkbookController({ merges: ['A1:B2'] });
    const sheet = controller.getSheetIds()[0]!;
    const before = controller.getValue();
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    expect(() => controller.dispatch({
      type: 'merge',
      selection: selection(sheet, {
        start: { row: 1, column: 1 }, end: { row: 2, column: 2 },
      }),
    }, 'toolbar')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(subscriber).not.toHaveBeenCalled();

    expect(controller.dispatch({
      type: 'merge',
      selection: selection(sheet, {
        start: { row: 0, column: 0 }, end: { row: 1, column: 1 },
      }),
    }, 'toolbar')).toEqual({ status: 'noop' });
  });

  it('rejects a selection outside the serialized grid before mutation', () => {
    const controller = new WorkbookController({ rows: { len: 2 }, cols: { len: 2 } });
    const sheet = controller.getSheetIds()[0]!;
    const before = controller.getValue();

    expect(() => controller.dispatch({
      type: 'merge',
      selection: selection(sheet, {
        start: { row: 0, column: 0 }, end: { row: 2, column: 1 },
      }),
    }, 'toolbar')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(before);
  });

  it('rejects merge only when it would delete a locked non-anchor cell', () => {
    const controller = new WorkbookController({
      rows: { len: 3, 0: { cells: { 1: { text: 'locked', editable: false } } } },
      cols: { len: 3 },
    });
    const sheet = controller.getSheetIds()[0]!;
    const before = controller.getValue();

    expect(() => controller.dispatch({
      type: 'merge', selection: selection(sheet, {
        start: { row: 0, column: 0 }, end: { row: 1, column: 1 },
      }),
    }, 'toolbar')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });

    const anchorController = new WorkbookController({
      merges: ['A1:B2'],
      rows: { len: 3, 0: { cells: { 0: { text: 'anchor', editable: false, merge: [1, 1] } } } },
      cols: { len: 3 },
    });
    const anchorSheet = anchorController.getSheetIds()[0]!;
    expect(anchorController.dispatch({
      type: 'unmerge', selection: selection(anchorSheet, {
        start: { row: 0, column: 0 }, end: { row: 1, column: 1 },
      }),
    }, 'toolbar').status).toBe('committed');
    expect(anchorController.getValue()[0]!.merges).toEqual([]);
  });
});

describe('autofill range operations', () => {
  it('extends numeric suffixes and shifts relative formula references', () => {
    expect(autofillText('Item1', 3, { row: 3, column: 0 })).toBe('Item4');
    expect(autofillText('-1', 1, { row: 1, column: 0 })).toBe('-2');
    expect(autofillText('plain', 3, { row: 3, column: 0 })).toBe('plain');
    expect(autofillText('=$A1+B$1', 2, { row: 2, column: 0 })).toBe('=$A3+B$1');
  });

  it('applies numeric, text, and formula fill through one atomic command', () => {
    const controller = new WorkbookController({
      rows: {
        len: 6,
        0: { cells: {
          0: { text: 'Item1', vendor: true },
          1: { text: '=A1+1' },
          2: { text: 'plain', style: 0 },
        } },
      },
      cols: { len: 4 },
      styles: [{ font: { italic: true } }],
    });
    const sheet = controller.getSheetIds()[0]!;
    const source = selection(sheet, {
      start: { row: 0, column: 0 }, end: { row: 0, column: 2 },
    });
    const target = selection(sheet, {
      start: { row: 1, column: 0 }, end: { row: 3, column: 2 },
    });

    expect(controller.dispatch({ type: 'autofill', source, target, mode: 'all' }, 'pointer'))
      .toMatchObject({ status: 'committed', commit: { change: { kind: 'autofill', range: target.range } } });
    expect(controller.getValue()[0]).toMatchObject({
      rows: {
        1: { cells: { 0: { text: 'Item2' }, 1: { text: '=A2+1' }, 2: { text: 'plain', style: 0 } } },
        2: { cells: { 0: { text: 'Item3' }, 1: { text: '=A3+1' }, 2: { text: 'plain', style: 0 } } },
        3: { cells: { 0: { text: 'Item4' }, 1: { text: '=A4+1' }, 2: { text: 'plain', style: 0 } } },
      },
    });
  });

  it.each([
    {
      name: 'horizontal forward', source: [[0, 0], [0, 1]], target: [[0, 2], [0, 5]],
      input: ['Item1', 'Item2'], expected: ['Item1', 'Item2', 'Item1', 'Item2'],
    },
    {
      name: 'horizontal reverse', source: [[0, 4], [0, 5]], target: [[0, 0], [0, 3]],
      input: ['Item1', 'Item2'], expected: ['Item1', 'Item2', 'Item1', 'Item2'],
    },
    {
      name: 'vertical forward', source: [[0, 0], [1, 0]], target: [[2, 0], [5, 0]],
      input: ['Item1', 'Item2'], expected: ['Item1', 'Item2', 'Item1', 'Item2'],
    },
    {
      name: 'vertical reverse', source: [[4, 0], [5, 0]], target: [[0, 0], [3, 0]],
      input: ['Item1', 'Item2'], expected: ['Item1', 'Item2', 'Item1', 'Item2'],
    },
  ])('repeats multi-cell numeric suffix sequences for $name same-axis fills', ({ source, target, input, expected }) => {
    const controller = new WorkbookController({ rows: { len: 8 }, cols: { len: 8 } });
    const sheet = controller.getSheetIds()[0]!;
    input.forEach((text, index) => {
      const horizontal = source[0]![0] === source[1]![0];
      controller.dispatch({
        type: 'set-cell-text',
        address: {
          sheet,
          row: source[0]![0] + (horizontal ? 0 : index),
          column: source[0]![1] + (horizontal ? index : 0),
        },
        text,
      }, 'ref');
    });
    const sourceRange = {
      start: { row: source[0]![0], column: source[0]![1] },
      end: { row: source[1]![0], column: source[1]![1] },
    };
    const targetRange = {
      start: { row: target[0]![0], column: target[0]![1] },
      end: { row: target[1]![0], column: target[1]![1] },
    };
    controller.dispatch({
      type: 'autofill', source: selection(sheet, sourceRange),
      target: selection(sheet, targetRange), mode: 'all',
    }, 'pointer');

    const horizontal = targetRange.start.row === targetRange.end.row;
    const actual = expected.map((_, index) => controller.getCellText({
      sheet,
      row: targetRange.start.row + (horizontal ? 0 : index),
      column: targetRange.start.column + (horizontal ? index : 0),
    }));
    expect(actual).toEqual(expected);
  });

  it('increments single-cell suffixes in all four directions and always shifts formulas by coordinates', () => {
    const controller = new WorkbookController({
      rows: {
        len: 7,
        1: { cells: { 4: { text: '=C3+$A$1' } } },
        3: { cells: { 3: { text: 'Item1' } } },
      },
      cols: { len: 7 },
    });
    const sheet = controller.getSheetIds()[0]!;
    const point = (row: number, column: number): CellRange => ({
      start: { row, column }, end: { row, column },
    });
    const targets: readonly CellRange[] = [
      { start: { row: 4, column: 3 }, end: { row: 5, column: 3 } },
      { start: { row: 1, column: 3 }, end: { row: 2, column: 3 } },
      { start: { row: 3, column: 4 }, end: { row: 3, column: 5 } },
      { start: { row: 3, column: 1 }, end: { row: 3, column: 2 } },
    ];
    for (const target of targets) {
      controller.dispatch({
        type: 'autofill', source: selection(sheet, point(3, 3)),
        target: selection(sheet, target), mode: 'value',
      }, 'pointer');
    }
    expect([
      controller.getCellText({ sheet, row: 4, column: 3 }),
      controller.getCellText({ sheet, row: 5, column: 3 }),
      controller.getCellText({ sheet, row: 1, column: 3 }),
      controller.getCellText({ sheet, row: 2, column: 3 }),
      controller.getCellText({ sheet, row: 3, column: 4 }),
      controller.getCellText({ sheet, row: 3, column: 5 }),
      controller.getCellText({ sheet, row: 3, column: 1 }),
      controller.getCellText({ sheet, row: 3, column: 2 }),
    ]).toEqual(['Item2', 'Item3', 'Item-1', 'Item0', 'Item2', 'Item3', 'Item-1', 'Item0']);

    controller.dispatch({
      type: 'autofill', source: selection(sheet, point(1, 4)),
      target: selection(sheet, point(2, 5)), mode: 'value',
    }, 'pointer');
    expect(controller.getCellText({ sheet, row: 2, column: 5 })).toBe('=D4+$A$1');
  });
});
