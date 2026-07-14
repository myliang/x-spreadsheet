import clipboardFixture from '../../parity/fixtures/operations/clipboard.json';
import { describe, expect, it } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import {
  clipboardMatrix,
  internalPasteRange,
  parseClipboardMatrix,
} from '../../../src/core/operations/clipboard';
import type { CellRange, Selection, SheetId } from '../../../src/core/types/coordinates';

const selection = (sheet: SheetId, range: CellRange): Selection => ({
  sheet,
  range,
  active: range.start,
});

describe('clipboard transformations', () => {
  it('serializes selections and parses external LF/CRLF tab matrices', () => {
    expect(clipboardMatrix(clipboardFixture.afterCopyPaste, {
      start: { row: 0, column: 0 }, end: { row: 0, column: 1 },
    })).toEqual([['A', 'B']]);
    expect(parseClipboardMatrix('A\tB\nC\tD')).toEqual([['A', 'B'], ['C', 'D']]);
    expect(parseClipboardMatrix('A\tB\r\nC\tD\r\n')).toEqual([['A', 'B'], ['C', 'D']]);
    expect(parseClipboardMatrix('')).toEqual([['']]);
  });

  it('@parity:clipboard.transform performs internal all copy and cut atomically', () => {
    const controller = new WorkbookController({
      name: 'Clipboard',
      styles: [{ font: { bold: true } }],
      rows: {
        len: 10,
        0: { cells: { 0: { text: 'A', style: 0 }, 1: { text: 'B' } } },
        2: { cells: { 0: { text: 'old', vendorCell: true }, 1: { text: 'old' } } },
      },
    });
    const sheet = controller.getSheetIds()[0]!;
    const source = selection(sheet, {
      start: { row: 0, column: 0 }, end: { row: 0, column: 1 },
    });
    const target = selection(sheet, {
      start: { row: 2, column: 0 }, end: { row: 2, column: 1 },
    });

    expect(controller.dispatch({
      type: 'paste-internal', source, target, mode: 'all', cut: false,
    }, 'clipboard')).toMatchObject({
      status: 'committed', commit: { change: { kind: 'clipboard', range: target.range } },
    });
    expect(controller.getValue()[0]).toMatchObject(clipboardFixture.afterCopyPaste);

    const cutTarget = selection(sheet, {
      start: { row: 0, column: 2 }, end: { row: 0, column: 3 },
    });
    expect(controller.dispatch({
      type: 'paste-internal', source, target: cutTarget, mode: 'all', cut: true,
    }, 'clipboard').status).toBe('committed');
    expect(controller.getValue()[0]).toMatchObject(clipboardFixture.afterCutPaste);
    expect(controller.historySize).toEqual({ undo: 2, redo: 0 });
  });

  it('anchors cut at target.start without tiling across a larger target selection', () => {
    const controller = new WorkbookController({
      rows: { len: 2, 0: { cells: {
        0: { text: 'source' }, 1: { text: 'first' },
        2: { text: 'second', editable: false, vendorTail: true },
      } } },
      cols: { len: 3 },
    });
    const sheet = controller.getSheetIds()[0]!;
    const source = selection(sheet, {
      start: { row: 0, column: 0 }, end: { row: 0, column: 0 },
    });
    const target = selection(sheet, {
      start: { row: 0, column: 1 }, end: { row: 0, column: 2 },
    });
    expect(internalPasteRange(source.range, target.range, true)).toEqual({
      start: { row: 0, column: 1 }, end: { row: 0, column: 1 },
    });
    expect(controller.dispatch({
      type: 'paste-internal', source, target, mode: 'all', cut: true,
    }, 'clipboard')).toMatchObject({
      status: 'committed',
      commit: { change: { range: { start: { row: 0, column: 1 }, end: { row: 0, column: 1 } } } },
    });
    expect(controller.getValue()[0]).toMatchObject({
      rows: { 0: { cells: {
        1: { text: 'source' }, 2: { text: 'second', editable: false, vendorTail: true },
      } } },
    });
    expect(controller.getValue()[0]!.rows?.['0']).not.toHaveProperty('cells.0');
  });

  it('moves a 2x2 cut snapshot through overlap without touching the larger selection tail', () => {
    const controller = new WorkbookController({
      rows: {
        len: 5,
        0: { cells: { 0: { text: 'A' }, 1: { text: 'B' } } },
        1: { cells: { 0: { text: 'C' }, 1: { text: 'D' } } },
        3: { cells: { 3: { text: 'tail', vendorTail: 1 } } },
      },
      cols: { len: 4 },
    });
    const sheet = controller.getSheetIds()[0]!;
    const result = controller.dispatch({
      type: 'paste-internal',
      source: selection(sheet, { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } }),
      target: selection(sheet, { start: { row: 1, column: 1 }, end: { row: 3, column: 3 } }),
      mode: 'all', cut: true,
    }, 'clipboard');
    expect(result).toMatchObject({
      status: 'committed',
      commit: { change: { range: { start: { row: 1, column: 1 }, end: { row: 2, column: 2 } } } },
    });
    expect(controller.getCellText({ sheet, row: 1, column: 1 })).toBe('A');
    expect(controller.getCellText({ sheet, row: 1, column: 2 })).toBe('B');
    expect(controller.getCellText({ sheet, row: 2, column: 1 })).toBe('C');
    expect(controller.getCellText({ sheet, row: 2, column: 2 })).toBe('D');
    expect(controller.getValue()[0]).toMatchObject({
      rows: { 3: { cells: { 3: { text: 'tail', vendorTail: 1 } } } },
    });
  });

  it('moves a merged 2x2 cut by source size and ignores merges in the selection tail', () => {
    const controller = new WorkbookController({
      rows: {
        len: 4,
        0: { cells: {
          0: { text: 'merged', merge: [1, 1], vendorSource: true },
          5: { text: 'outside', merge: [0, 1], vendorOutside: true },
        } },
      },
      cols: { len: 7 },
      merges: ['A1:B2', 'F1:G1'],
    });
    const sheet = controller.getSheetIds()[0]!;
    expect(controller.dispatch({
      type: 'paste-internal',
      source: selection(sheet, { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } }),
      target: selection(sheet, { start: { row: 0, column: 3 }, end: { row: 2, column: 6 } }),
      mode: 'all', cut: true,
    }, 'clipboard')).toMatchObject({
      status: 'committed',
      commit: { change: { range: { start: { row: 0, column: 3 }, end: { row: 1, column: 4 } } } },
    });
    expect(controller.getValue()[0]).toMatchObject({
      merges: ['F1:G1', 'D1:E2'],
      rows: { 0: { cells: {
        3: { text: 'merged', merge: [1, 1], vendorSource: true },
        5: { text: 'outside', merge: [0, 1], vendorOutside: true },
      } } },
    });
  });

  it('supports value-only and format-only paste without losing unrelated cell extensions', () => {
    const controller = new WorkbookController({
      styles: [{ font: { bold: true } }, { color: '#f00' }],
      rows: {
        len: 4,
        0: { cells: { 0: { text: 'source', style: 0, vendorSource: 1 } } },
        1: { cells: { 0: { text: 'target', style: 1, vendorTarget: false } } },
        2: { cells: { 0: { text: 'format-target', style: 1, vendorFormat: '' } } },
      },
      cols: { len: 2 },
    });
    const sheet = controller.getSheetIds()[0]!;
    const source = selection(sheet, { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } });

    controller.dispatch({
      type: 'paste-internal', source,
      target: selection(sheet, { start: { row: 1, column: 0 }, end: { row: 1, column: 0 } }),
      mode: 'value', cut: false,
    }, 'clipboard');
    controller.dispatch({
      type: 'paste-internal', source,
      target: selection(sheet, { start: { row: 2, column: 0 }, end: { row: 2, column: 0 } }),
      mode: 'format', cut: false,
    }, 'clipboard');

    expect(controller.getValue()[0]).toMatchObject({
      rows: {
        1: { cells: { 0: { text: 'source', style: 1, vendorTarget: false } } },
        2: { cells: { 0: { text: 'format-target', style: 0, vendorFormat: '' } } },
      },
    });
  });

  it.each(['all', 'format'] as const)(
    'keeps top-level and cell merge metadata synchronized for partial %s tiles',
    (mode) => {
      const controller = new WorkbookController({
        vendorSheet: { keep: true },
        styles: [{ font: { bold: true } }, { color: '#f00' }],
        rows: {
          len: 4,
          0: { cells: {
            0: { text: 'merged', style: 0, merge: [1, 1], vendorSource: 1 },
            3: { text: 'D', value: 3, style: 1, vendorTarget: 'D' },
            5: { text: 'F', value: 5, style: 1, vendorTarget: 'F' },
            7: { text: 'outside', merge: [1, 1], vendorOutside: true },
          } },
          2: { cells: {
            3: { text: 'D3', value: 23, style: 1, vendorTarget: 'D3' },
            5: { text: 'F3', value: 25, style: 1, vendorTarget: 'F3' },
          } },
        },
        cols: { len: 9 },
        merges: ['A1:B2', 'H1:I2'],
      });
      const sheet = controller.getSheetIds()[0]!;
      expect(controller.dispatch({
        type: 'paste-internal',
        source: selection(sheet, { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } }),
        target: selection(sheet, { start: { row: 0, column: 3 }, end: { row: 2, column: 5 } }),
        mode, cut: false,
      }, 'clipboard').status).toBe('committed');

      const value = controller.getValue()[0]!;
      expect(value.merges).toEqual(['A1:B2', 'H1:I2', 'D1:E2']);
      expect(value).toMatchObject({
        vendorSheet: { keep: true },
        rows: { 0: { cells: {
          3: { style: 0, merge: [1, 1] },
          5: { style: 0 },
          7: { text: 'outside', merge: [1, 1], vendorOutside: true },
        } }, 2: { cells: { 3: { style: 0 }, 5: { style: 0 } } } },
      });
      for (const [row, column] of [[0, 5], [2, 3], [2, 5]]) {
        expect(value.rows?.[String(row)]).not.toHaveProperty(`cells.${column}.merge`);
      }
      if (mode === 'format') {
        expect(value).toMatchObject({ rows: {
          0: { cells: {
            3: { text: 'D', value: 3, vendorTarget: 'D' },
            5: { text: 'F', value: 5, vendorTarget: 'F' },
          } },
          2: { cells: {
            3: { text: 'D3', value: 23, vendorTarget: 'D3' },
            5: { text: 'F3', value: 25, vendorTarget: 'F3' },
          } },
        } });
      } else {
        expect(value).toMatchObject({ rows: {
          0: { cells: {
            3: { text: 'merged', vendorSource: 1 },
            5: { text: 'merged', vendorSource: 1 },
          } },
          2: { cells: {
            3: { text: 'merged', vendorSource: 1 },
            5: { text: 'merged', vendorSource: 1 },
          } },
        } });
      }
    },
  );

  it('distinguishes absent, textless, and explicit-empty source cells during value paste', () => {
    const controller = new WorkbookController({
      styles: [{ font: { bold: true } }],
      rows: {
        len: 3,
        0: { cells: { 1: { value: 7, vendorTextless: 0 }, 2: { text: '', value: 8 } } },
        1: { cells: {
          0: { text: 'keep', value: 1, vendorAbsent: false },
          1: { text: 'remove', value: 2, vendorTarget: '' },
          2: { text: 'replace', value: 3 },
        } },
        2: { cells: {
          0: { text: 'all-stays', style: 0, vendorAll: true },
          1: { text: 'format-stays', value: 10, style: 0, merge: [0, 1], vendorFormat: true },
        } },
      },
      cols: { len: 4 },
    });
    const sheet = controller.getSheetIds()[0]!;
    controller.dispatch({
      type: 'paste-internal',
      source: selection(sheet, { start: { row: 0, column: 0 }, end: { row: 0, column: 2 } }),
      target: selection(sheet, { start: { row: 1, column: 0 }, end: { row: 1, column: 2 } }),
      mode: 'value', cut: false,
    }, 'clipboard');

    expect(controller.getValue()[0]).toMatchObject({
      rows: { 1: { cells: {
        0: { text: 'keep', value: 1, vendorAbsent: false },
        1: { vendorTarget: '' },
        2: { text: '' },
      } } },
    });
    expect(controller.getValue()[0]!.rows?.['1']).not.toHaveProperty('cells.1.text');
    expect(controller.getValue()[0]!.rows?.['1']).not.toHaveProperty('cells.1.value');
    expect(controller.getValue()[0]!.rows?.['1']).not.toHaveProperty('cells.2.value');

    const absent = selection(sheet, {
      start: { row: 0, column: 0 }, end: { row: 0, column: 0 },
    });
    expect(controller.dispatch({
      type: 'paste-internal', source: absent,
      target: selection(sheet, { start: { row: 2, column: 0 }, end: { row: 2, column: 0 } }),
      mode: 'all', cut: false,
    }, 'clipboard').status).toBe('committed');
    expect(controller.dispatch({
      type: 'paste-internal', source: absent,
      target: selection(sheet, { start: { row: 2, column: 1 }, end: { row: 2, column: 1 } }),
      mode: 'format', cut: false,
    }, 'clipboard').status).toBe('committed');
    expect(controller.getValue()[0]).toMatchObject({ rows: { 2: { cells: {
      1: { text: 'format-stays', value: 10, vendorFormat: true },
    } } } });
    expect(controller.getValue()[0]!.rows?.['2']).not.toHaveProperty('cells.0');
    expect(controller.getValue()[0]!.rows?.['2']).not.toHaveProperty('cells.1.style');
    expect(controller.getValue()[0]!.rows?.['2']).not.toHaveProperty('cells.1.merge');

    const cutController = new WorkbookController({
      rows: { len: 3, 1: { cells: { 0: { text: 'cut-target', value: 9, vendorCut: 0 } } } },
      cols: { len: 2 },
    });
    const cutSheet = cutController.getSheetIds()[0]!;
    expect(cutController.dispatch({
      type: 'paste-internal',
      source: selection(cutSheet, { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }),
      target: selection(cutSheet, { start: { row: 1, column: 0 }, end: { row: 1, column: 0 } }),
      mode: 'all', cut: true,
    }, 'clipboard')).toEqual({ status: 'noop' });
    expect(cutController.getValue()[0]).toMatchObject({
      rows: { 1: { cells: { 0: { text: 'cut-target', value: 9, vendorCut: 0 } } } },
    });
  });

  it('pastes an external matrix, expands from the target anchor, and rejects locked cells atomically', () => {
    const controller = new WorkbookController({
      rows: { len: 4, 0: { cells: { 0: { vendor: 'keep' } } } },
      cols: { len: 4 },
    });
    const sheet = controller.getSheetIds()[0]!;
    const target = selection(sheet, { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } });
    const result = controller.dispatch({
      type: 'paste-external', target, values: [['A', 'B'], ['C', 'D']],
    }, 'clipboard');

    expect(result).toMatchObject({
      status: 'committed',
      commit: { change: { range: { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } } } },
    });
    expect(controller.getValue()[0]).toMatchObject({
      rows: {
        0: { cells: { 0: { text: 'A', vendor: 'keep' }, 1: { text: 'B' } } },
        1: { cells: { 0: { text: 'C' }, 1: { text: 'D' } } },
      },
    });

    const locked = new WorkbookController({
      rows: { len: 2, 0: { cells: { 1: { text: 'locked', editable: false } } } },
      cols: { len: 2 },
    });
    const lockedSheet = locked.getSheetIds()[0]!;
    const before = locked.getValue();
    expect(() => locked.dispatch({
      type: 'paste-external',
      target: selection(lockedSheet, {
        start: { row: 0, column: 0 }, end: { row: 0, column: 0 },
      }),
      values: [['A', 'B']],
    }, 'clipboard')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(locked.getValue()).toEqual(before);
    expect(locked.historySize.undo).toBe(0);
  });

  it('rejects merged targets and oversized transforms before any partial mutation', () => {
    const merged = new WorkbookController({
      rows: { len: 4, 0: { cells: { 0: { text: 'source' } } } },
      cols: { len: 3 },
      merges: ['A2:B2'],
    });
    const sheet = merged.getSheetIds()[0]!;
    const before = merged.getValue();
    expect(() => merged.dispatch({
      type: 'paste-internal',
      source: selection(sheet, { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }),
      target: selection(sheet, { start: { row: 1, column: 0 }, end: { row: 1, column: 0 } }),
      mode: 'all',
      cut: false,
    }, 'clipboard')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(merged.getValue()).toEqual(before);

    const oversized = new WorkbookController({ rows: { len: 250_002 }, cols: { len: 1 } });
    const oversizedSheet = oversized.getSheetIds()[0]!;
    expect(() => oversized.dispatch({
      type: 'paste-internal',
      source: selection(oversizedSheet, {
        start: { row: 0, column: 0 }, end: { row: 250_000, column: 0 },
      }),
      target: selection(oversizedSheet, {
        start: { row: 0, column: 0 }, end: { row: 0, column: 0 },
      }),
      mode: 'value',
      cut: false,
    }, 'clipboard')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(oversized.historySize.undo).toBe(0);
  });
});
