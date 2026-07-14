import mergeFixture from '../../parity/fixtures/operations/merge.json';
import { describe, expect, it, vi } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
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
});
