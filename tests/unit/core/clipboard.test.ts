import clipboardFixture from '../../parity/fixtures/operations/clipboard.json';
import { describe, expect, it } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import {
  clipboardMatrix,
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
          1: { text: 'format-stays', style: 0, vendorFormat: true },
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
    }, 'clipboard')).toEqual({ status: 'noop' });
    expect(controller.dispatch({
      type: 'paste-internal', source: absent,
      target: selection(sheet, { start: { row: 2, column: 1 }, end: { row: 2, column: 1 } }),
      mode: 'format', cut: false,
    }, 'clipboard')).toEqual({ status: 'noop' });
    expect(controller.getValue()[0]).toMatchObject({ rows: { 2: { cells: {
      0: { text: 'all-stays', style: 0, vendorAll: true },
      1: { text: 'format-stays', style: 0, vendorFormat: true },
    } } } });
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
