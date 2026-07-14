import { describe, expect, it, vi } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import type { CellAddress } from '../../../src/core/types/coordinates';

function address(controller: WorkbookController, row = 0, column = 0): CellAddress {
  return { sheet: controller.getSheetIds()[0]!, row, column };
}

describe('cell editing operations', () => {
  it('@parity:editing.commit-cancel commits once, invalidates cache, and keeps extensions', () => {
    const controller = new WorkbookController({
      vendorSheet: { keep: true },
      rows: {
        vendorRows: 'keep',
        0: {
          vendorRow: 0,
          cells: {
            0: { text: 'before', value: 3, editable: true, vendorCell: false },
          },
        },
      },
    });
    const events = vi.fn();
    controller.subscribe(events);

    const outcome = controller.dispatch({
      type: 'set-cell-text',
      address: address(controller),
      text: '=1+2',
    }, 'keyboard');

    expect(outcome.status).toBe('committed');
    expect(controller.getValue()[0]).toMatchObject({
      vendorSheet: { keep: true },
      rows: {
        vendorRows: 'keep',
        0: { vendorRow: 0, cells: { 0: { text: '=1+2', editable: true, vendorCell: false } } },
      },
    });
    expect((controller.getValue()[0]!.rows?.['0'] as never)).not.toHaveProperty('cells.0.value');
    expect(events).toHaveBeenCalledTimes(1);
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
  });

  it('treats editor cancel/same text as a no-op and rejects editable false atomically', () => {
    const controller = new WorkbookController({
      rows: { 0: { cells: { 0: { text: 'same' }, 1: { text: 'locked', editable: false } } } },
    });
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    expect(controller.dispatch({
      type: 'set-cell-text', address: address(controller), text: 'same',
    }, 'keyboard')).toEqual({ status: 'noop' });
    expect(() => controller.dispatch({
      type: 'set-cell-text', address: address(controller, 0, 1), text: 'changed',
    }, 'keyboard')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getCellText(address(controller, 0, 1))).toBe('locked');
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(subscriber).not.toHaveBeenCalled();
  });
});
