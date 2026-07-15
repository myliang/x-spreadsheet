import { describe, expect, it } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import { sheetId } from '../../../src/core/types/coordinates';
import type { Selection } from '../../../src/core/types/coordinates';
import { remapWorkbookCommand } from '../../../src/react/control/controlled-reconciler';

function selection(controller: WorkbookController, endRow = 0, endColumn = 1): Selection {
  return {
    sheet: controller.getSheetIds()[0]!,
    active: { row: 0, column: 0 },
    range: {
      start: { row: 0, column: 0 },
      end: { row: endRow, column: endColumn },
    },
  };
}

describe('cell metadata commands', () => {
  it('sets printable metadata across a range, preserves cell data, and undoes atomically', () => {
    const controller = new WorkbookController({
      rows: {
        len: 2,
        0: { cells: {
          0: { text: 'A', style: 0, vendorCell: { keep: true } },
          1: { text: 'B', editable: false },
        } },
      },
      cols: { len: 2 },
      styles: [{ color: '#f00' }],
    });
    const before = controller.getValue();

    const outcome = controller.dispatch({
      type: 'set-cell-metadata',
      selection: selection(controller),
      property: 'printable',
      value: false,
    }, 'context-menu');

    expect(outcome.status).toBe('committed');
    expect(outcome.status === 'committed' && outcome.commit.change).toMatchObject({
      kind: 'cell',
      source: 'context-menu',
      range: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } },
    });
    expect(controller.getValue()[0]).toMatchObject({
      rows: { 0: { cells: {
        0: { text: 'A', style: 0, printable: false, vendorCell: { keep: true } },
        1: { text: 'B', editable: false, printable: false },
      } } },
    });
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
    expect(controller.undo('context-menu').status).toBe('committed');
    expect(controller.getValue()).toEqual(before);
  });

  it('can re-enable editing on locked cells and keeps same-value updates silent', () => {
    const controller = new WorkbookController({
      rows: { len: 1, 0: { cells: { 0: { text: 'locked', editable: false } } } },
      cols: { len: 2 },
    });
    const target = selection(controller, 0, 1);

    expect(controller.dispatch({
      type: 'set-cell-metadata',
      selection: target,
      property: 'editable',
      value: true,
    }, 'context-menu').status).toBe('committed');
    expect(controller.getValue()[0]).toMatchObject({
      rows: { 0: { cells: {
        0: { text: 'locked', editable: true },
        1: { editable: true },
      } } },
    });
    expect(controller.dispatch({
      type: 'set-cell-metadata',
      selection: target,
      property: 'editable',
      value: true,
    }, 'context-menu')).toEqual({ status: 'noop' });
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
  });

  it('rejects malformed and oversized metadata commands without mutation', () => {
    const controller = new WorkbookController({ rows: { len: 501 }, cols: { len: 500 } });
    const before = controller.getValue();

    expect(() => controller.dispatch({
      type: 'set-cell-metadata',
      selection: selection(controller, 500, 499),
      property: 'printable',
      value: false,
    }, 'context-menu')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(() => controller.dispatch({
      type: 'set-cell-metadata',
      selection: selection(controller, 0, 0),
      property: 'unknown',
      value: false,
    } as never, 'context-menu')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
  });

  it('remaps controlled selections and respects the controller read-only boundary', () => {
    const controller = new WorkbookController({ rows: { len: 1 }, cols: { len: 1 } });
    const original = selection(controller, 0, 0);
    const remapped = remapWorkbookCommand({
      type: 'set-cell-metadata',
      selection: original,
      property: 'editable',
      value: false,
    }, new Map([[original.sheet, sheetId('replacement')]]));
    expect(remapped).toMatchObject({
      type: 'set-cell-metadata',
      selection: { sheet: sheetId('replacement') },
      property: 'editable',
      value: false,
    });

    controller.setReadOnly(true);
    expect(() => controller.dispatch({
      type: 'set-cell-metadata',
      selection: original,
      property: 'editable',
      value: false,
    }, 'context-menu')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
  });
});
