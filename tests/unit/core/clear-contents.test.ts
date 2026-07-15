import { describe, expect, it, vi } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import type { Selection } from '../../../src/core/types/coordinates';

function selection(
  controller: WorkbookController,
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
): Selection {
  const sheet = controller.getSheetIds()[0]!;
  return {
    sheet,
    active: { row: startRow, column: startColumn },
    range: {
      start: { row: startRow, column: startColumn },
      end: { row: endRow, column: endColumn },
    },
  };
}

describe('clear contents', () => {
  it('deletes text and cached values across a range while preserving cell metadata', () => {
    const controller = new WorkbookController({
      styles: [{ color: '#f00' }],
      rows: {
        0: { cells: {
          0: { text: 'A', value: 1, style: 0, vendorCell: { keep: true } },
          1: { text: '=1+1', value: 2, editable: true },
          2: { text: 'outside', value: 3 },
        } },
      },
    });
    const before = controller.getValue();
    const events = vi.fn();
    controller.subscribe(events);

    const outcome = controller.dispatch({
      type: 'clear-contents',
      selection: selection(controller, 0, 0, 0, 1),
    }, 'keyboard');

    expect(outcome.status).toBe('committed');
    expect(outcome.status === 'committed' && outcome.commit.change.kind).toBe('cell');
    expect(controller.getValue()[0]).toMatchObject({
      rows: { 0: { cells: {
        0: { style: 0, vendorCell: { keep: true } },
        1: { editable: true },
        2: { text: 'outside', value: 3 },
      } } },
    });
    expect((controller.getValue()[0]!.rows?.['0'] as never)).not.toHaveProperty('cells.0.text');
    expect((controller.getValue()[0]!.rows?.['0'] as never)).not.toHaveProperty('cells.1.text');
    expect((controller.getValue()[0]!.rows?.['0'] as never)).not.toHaveProperty('cells.0.value');
    expect((controller.getValue()[0]!.rows?.['0'] as never)).not.toHaveProperty('cells.1.value');
    expect(events).toHaveBeenCalledOnce();
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });

    expect(controller.undo('keyboard').status).toBe('committed');
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize).toEqual({ undo: 0, redo: 1 });
  });

  it('keeps an already empty range silent and history-free', () => {
    const controller = new WorkbookController({
      rows: {
        len: 2,
        0: { cells: {
          0: { text: '', style: 0 },
          1: { style: 0, vendorCell: 'metadata-only' },
        } },
        1: { cells: { 0: { editable: true, printable: false } } },
      },
      cols: { len: 2 },
      styles: [{ color: '#f00' }],
    });
    const before = controller.getValue();
    const events = vi.fn();
    controller.subscribe(events);

    expect(controller.dispatch({
      type: 'clear-contents',
      selection: selection(controller, 0, 0, 1, 1),
    }, 'keyboard')).toEqual({ status: 'noop' });
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
    expect(events).not.toHaveBeenCalled();
  });

  it('removes standalone cached representations without introducing empty text', () => {
    const controller = new WorkbookController({
      rows: { 0: { cells: {
        0: { value: 0, style: 0, vendorCell: false },
        1: { text: '', value: false, editable: true },
      } } },
      styles: [{ color: '#f00' }],
    });
    const before = controller.getValue();

    expect(controller.dispatch({
      type: 'clear-contents',
      selection: selection(controller, 0, 0, 0, 1),
    }, 'keyboard').status).toBe('committed');
    expect(controller.getValue()[0]!.rows?.['0']).toMatchObject({
      cells: {
        0: { style: 0, vendorCell: false },
        1: { editable: true },
      },
    });
    expect((controller.getValue()[0]!.rows?.['0'] as never)).not.toHaveProperty('cells.0.text');
    expect((controller.getValue()[0]!.rows?.['0'] as never)).not.toHaveProperty('cells.0.value');
    expect((controller.getValue()[0]!.rows?.['0'] as never)).not.toHaveProperty('cells.1.text');
    expect((controller.getValue()[0]!.rows?.['0'] as never)).not.toHaveProperty('cells.1.value');

    expect(controller.undo('keyboard').status).toBe('committed');
    expect(controller.getValue()).toEqual(before);
  });

  it('rejects locked and oversized ranges atomically', () => {
    const locked = new WorkbookController({
      rows: { len: 2, 0: { cells: { 0: { text: 'safe' }, 1: { text: 'locked', editable: false } } } },
      cols: { len: 2 },
    });
    const lockedBefore = locked.getValue();
    expect(() => locked.dispatch({
      type: 'clear-contents',
      selection: selection(locked, 0, 0, 0, 1),
    }, 'keyboard')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(locked.getValue()).toEqual(lockedBefore);
    expect(locked.historySize).toEqual({ undo: 0, redo: 0 });

    const oversized = new WorkbookController({ rows: { len: 501 }, cols: { len: 500 } });
    expect(() => oversized.dispatch({
      type: 'clear-contents',
      selection: selection(oversized, 0, 0, 500, 499),
    }, 'keyboard')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(oversized.historySize).toEqual({ undo: 0, redo: 0 });
  });
});
