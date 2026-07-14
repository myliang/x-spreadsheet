import structureFixture from '../../parity/fixtures/operations/structure.json';
import { describe, expect, it, vi } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import type { WorkbookInput } from '../../../src/core/types/workbook';

describe('row and column structure operations', () => {
  it('@parity:structure.row-column-operations matches the captured insert/delete stages', () => {
    const controller = new WorkbookController(
      structureFixture.stages[0]!.sheet as unknown as WorkbookInput,
    );
    const sheet = controller.getSheetIds()[0]!;

    const insertedRow = controller.dispatch({ type: 'insert-row', sheet, index: 1 }, 'context-menu');
    expect(controller.getValue()[0]).toEqual(structureFixture.stages[1]!.sheet);
    expect(insertedRow).toMatchObject({
      status: 'committed',
      commit: { change: { kind: 'structure', sheet, range: {
        start: { row: 1, column: 0 }, end: { row: 1, column: 4 },
      } } },
    });

    controller.dispatch({ type: 'delete-row', sheet, index: 1 }, 'context-menu');
    expect(controller.getValue()[0]).toEqual(structureFixture.stages[2]!.sheet);
    controller.dispatch({ type: 'insert-column', sheet, index: 1 }, 'context-menu');
    expect(controller.getValue()[0]).toEqual(structureFixture.stages[3]!.sheet);
    controller.dispatch({ type: 'delete-column', sheet, index: 1 }, 'context-menu');
    expect(controller.getValue()[0]).toEqual(structureFixture.stages[4]!.sheet);
    expect(controller.historySize.undo).toBe(4);
  });

  it('resizes and hides rows/columns with exact ranges, extensions, no-op silence, and undo', () => {
    const controller = new WorkbookController({
      rows: { len: 4, vendorRows: false, 2: { height: 20, hide: false, vendorRow: 'keep' } },
      cols: { len: 3, vendorCols: 0, 1: { width: 80, hide: false, vendorColumn: 'keep' } },
    });
    const sheet = controller.getSheetIds()[0]!;
    const events = vi.fn();
    controller.subscribe(events);

    expect(controller.dispatch({ type: 'set-row-height', sheet, row: 2, height: 20 }, 'pointer'))
      .toEqual({ status: 'noop' });
    controller.dispatch({ type: 'set-row-height', sheet, row: 2, height: 44 }, 'pointer');
    controller.dispatch({ type: 'set-row-hidden', sheet, row: 2, hidden: true }, 'context-menu');
    controller.dispatch({ type: 'set-column-width', sheet, column: 1, width: 120 }, 'pointer');
    controller.dispatch({ type: 'set-column-hidden', sheet, column: 1, hidden: true }, 'context-menu');

    expect(controller.getValue()[0]).toMatchObject({
      rows: { vendorRows: false, 2: { height: 44, hide: true, vendorRow: 'keep' } },
      cols: { vendorCols: 0, 1: { width: 120, hide: true, vendorColumn: 'keep' } },
    });
    expect(events).toHaveBeenCalledTimes(4);
    expect(events.mock.calls.map(call => call[0].commit.change.range)).toEqual([
      { start: { row: 2, column: 0 }, end: { row: 2, column: 2 } },
      { start: { row: 2, column: 0 }, end: { row: 2, column: 2 } },
      { start: { row: 0, column: 1 }, end: { row: 3, column: 1 } },
      { start: { row: 0, column: 1 }, end: { row: 3, column: 1 } },
    ]);
    controller.undo();
    expect(controller.getValue()[0]!.cols?.['1']).toMatchObject({ hide: false });
  });

  it('rejects out-of-bounds deletion and merge-destroying structure atomically', () => {
    const controller = new WorkbookController({
      merges: ['A1:B2'],
      rows: { len: 2, 0: { cells: { 0: { text: 'kept', merge: [1, 1] } } } },
      cols: { len: 2 },
    });
    const sheet = controller.getSheetIds()[0]!;
    const before = controller.getValue();
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    expect(() => controller.dispatch({
      type: 'delete-row', sheet, index: 0, count: 3,
    }, 'context-menu')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(() => controller.dispatch({
      type: 'delete-column', sheet, index: 0,
    }, 'context-menu')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(subscriber).not.toHaveBeenCalled();
  });
});
