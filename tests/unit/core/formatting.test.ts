import { describe, expect, it } from 'vitest';
import {
  addStyle,
  FORMAT_DEFINITIONS,
  formatValue,
  normalizeStyle,
  stylesEqual,
} from '../../../src/core';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import type { Selection, SheetId } from '../../../src/core/types/coordinates';
import type { BorderLine, CellBorders, CellStyle } from '../../../src/core';

describe('legacy formats', () => {
  it('exposes every approved legacy format in stable order', () => {
    expect(FORMAT_DEFINITIONS.map(format => format.key)).toEqual([
      'normal', 'text', 'number', 'percent', 'rmb', 'usd', 'eur',
      'date', 'time', 'datetime', 'duration',
    ]);
  });

  it.each([
    ['normal', 'AC', 'AC'],
    ['text', 'abc', 'abc'],
    ['number', '11000.20', '11,000.20'],
    ['number', '110,00.20', '110,00.20'],
    ['number', '-1200', '-1,200.00'],
    ['percent', '50.456', '50.456%'],
    ['rmb', '1200.333', '￥1,200.33'],
    ['usd', '1200.333', '$1,200.33'],
    ['eur', '1200.333', '€1,200.33'],
    ['date', '26/09/2008', '26/09/2008'],
    ['time', '15:59:00', '15:59:00'],
    ['datetime', '26/09/2008 15:59:00', '26/09/2008 15:59:00'],
    ['duration', '24:01:00', '24:01:00'],
  ])('@parity:formatting.number-and-date %s renders %j', (format, value, expected) => {
    expect(formatValue(format, value)).toBe(expected);
  });

  it('falls back to the normal renderer for unknown preserved format keys', () => {
    expect(formatValue('vendor-format', 'kept')).toBe('kept');
  });
});

const selected = (
  sheet: SheetId,
  startRow: number,
  startColumn: number,
  endRow = startRow,
  endColumn = startColumn,
): Selection => ({
  sheet,
  active: { row: startRow, column: startColumn },
  range: {
    start: { row: startRow, column: startColumn },
    end: { row: endRow, column: endColumn },
  },
});

describe('formatting commands', () => {
  it('@parity:formatting.commands applies every public style field as one deduplicated command', () => {
    const controller = new WorkbookController({
      styles: [{ vendorStyle: { keep: true }, font: { name: 'Arial' } }],
      rows: { 0: { cells: { 0: { text: 'A', style: 0 }, 1: { text: 'B', style: 0 } } } },
    });
    const sheet = controller.getSheetIds()[0]!;
    const patch = {
      format: 'percent',
      bgcolor: '#fff000',
      align: 'center' as const,
      valign: 'bottom' as const,
      textwrap: true,
      strike: true,
      underline: true,
      color: '#123456',
      font: { name: 'Inter', size: 13, bold: true, italic: true, vendorFont: 0 },
      border: {
        top: ['thin', '#000'] as const,
        right: ['medium'] as const,
        bottom: ['dashed', '#111'] as const,
        left: ['double', '#222'] as const,
        vendorBorder: false,
      },
      vendorPatch: '',
    };

    const outcome = controller.dispatch({
      type: 'set-style', selection: selected(sheet, 0, 0, 0, 1), patch,
    }, 'toolbar');

    expect(outcome).toMatchObject({
      status: 'committed',
      commit: { change: { kind: 'style', range: selected(sheet, 0, 0, 0, 1).range } },
    });
    const value = controller.getValue()[0]!;
    expect(value.styles).toHaveLength(2);
    expect(value.styles?.[1]).toEqual({
      vendorStyle: { keep: true },
      ...patch,
      font: { name: 'Inter', size: 13, bold: true, italic: true, vendorFont: 0 },
    });
    expect(value.rows?.['0']).toMatchObject({ cells: { 0: { style: 1 }, 1: { style: 1 } } });
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
  });

  it('clears and paints tiled direct formats while preserving unrelated cell extensions', () => {
    const controller = new WorkbookController({
      styles: [{ color: 'red' }, { font: { bold: true }, vendorStyle: 'keep' }],
      rows: {
        0: { cells: { 0: { text: 'source', style: 1, vendorCell: 0 } } },
        1: { cells: { 1: { text: 'one', style: 0, vendorCell: false }, 2: { text: 'two' } } },
      },
    });
    const sheet = controller.getSheetIds()[0]!;

    controller.dispatch({
      type: 'paint-format',
      source: selected(sheet, 0, 0),
      target: selected(sheet, 1, 1, 1, 2),
    }, 'toolbar');
    expect(controller.getValue()[0]!.rows?.['1']).toMatchObject({
      cells: {
        1: { text: 'one', style: 1, vendorCell: false },
        2: { text: 'two', style: 1 },
      },
    });
    expect(controller.getValue()[0]!.styles).toHaveLength(2);

    controller.dispatch({
      type: 'clear-format', selection: selected(sheet, 1, 1, 1, 2),
    }, 'toolbar');
    expect(controller.getValue()[0]!.rows?.['1']).toMatchObject({
      cells: { 1: { text: 'one', vendorCell: false }, 2: { text: 'two' } },
    });
    const row = controller.getValue()[0]!.rows?.['1'] as {
      readonly cells?: Readonly<Record<string, unknown>>;
    };
    expect(row.cells?.['1']).not.toHaveProperty('style');
  });

  it('clear-format removes contained merges together with styles', () => {
    const controller = new WorkbookController({
      merges: ['A1:B2'],
      styles: [{ color: 'red' }],
      rows: { 0: { cells: { 0: { text: 'anchor', style: 0, merge: [1, 1] } } } },
    });
    const sheet = controller.getSheetIds()[0]!;

    const outcome = controller.dispatch({
      type: 'clear-format', selection: selected(sheet, 0, 0, 1, 1),
    }, 'toolbar');

    expect(outcome).toMatchObject({ status: 'committed', commit: { change: { kind: 'style' } } });
    expect(controller.getValue()[0]!.merges).toEqual([]);
    expect(controller.getValue()[0]!.rows?.['0']).toMatchObject({
      cells: { 0: { text: 'anchor' } },
    });
    expect(controller.getValue()[0]!.rows?.['0']).not.toHaveProperty('cells.0.style');
    expect(controller.getValue()[0]!.rows?.['0']).not.toHaveProperty('cells.0.merge');
  });

  it('paint-format copies styles and merges, expands a smaller target, and reports the actual range', () => {
    const controller = new WorkbookController({
      merges: ['A1:B2'],
      styles: [{ font: { bold: true } }],
      rows: {
        0: { cells: { 0: { text: 'source', style: 0, merge: [1, 1] } } },
        3: { cells: { 3: { text: 'target', vendorCell: false } } },
      },
    });
    const sheet = controller.getSheetIds()[0]!;

    const outcome = controller.dispatch({
      type: 'paint-format',
      source: selected(sheet, 0, 0, 1, 1),
      target: selected(sheet, 3, 3),
    }, 'toolbar');

    expect(outcome).toMatchObject({
      status: 'committed',
      commit: { change: { range: {
        start: { row: 3, column: 3 }, end: { row: 4, column: 4 },
      } } },
    });
    expect(controller.getValue()[0]!.merges).toEqual(['A1:B2', 'D4:E5']);
    expect(controller.getValue()[0]!.rows?.['3']).toMatchObject({
      cells: { 3: { text: 'target', style: 0, merge: [1, 1], vendorCell: false } },
    });
  });

  it('rejects paint merge conflicts and every locked-cell format mutation atomically', () => {
    const controller = new WorkbookController({
      merges: ['A1:B2', 'D4:E5'],
      styles: [{ color: 'red' }],
      rows: {
        0: { cells: { 0: { style: 0, merge: [1, 1] } } },
        3: { cells: { 3: { text: 'locked', style: 0, merge: [1, 1], editable: false } } },
      },
    });
    const sheet = controller.getSheetIds()[0]!;
    const before = controller.getValue();

    for (const command of [
      { type: 'set-style', selection: selected(sheet, 3, 3), patch: { color: 'blue' } },
      { type: 'clear-format', selection: selected(sheet, 3, 3, 4, 4) },
      {
        type: 'paint-format',
        source: selected(sheet, 0, 0, 1, 1),
        target: selected(sheet, 3, 3),
      },
    ] as const) {
      expect(() => controller.dispatch(command, 'toolbar'))
        .toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    }
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
  });

  const line = ['thin', '#123'] as const satisfies BorderLine;
  const borderCases: readonly [string, readonly CellBorders[]][] = [
    ['all', [
      { top: line, right: line, bottom: line, left: line },
      { top: line, right: line, bottom: line, left: line },
      { top: line, right: line, bottom: line, left: line },
      { top: line, right: line, bottom: line, left: line },
    ]],
    ['inside', [{ right: line, bottom: line }, { bottom: line }, { right: line }, {}]],
    ['outside', [{ top: line, left: line }, { top: line, right: line }, { bottom: line, left: line }, { right: line, bottom: line }]],
    ['horizontal', [{ bottom: line }, { bottom: line }, {}, {}]],
    ['vertical', [{ right: line }, {}, { right: line }, {}]],
  ];

  it.each(borderCases)('applies legacy %s borders in one history entry', (mode, expected) => {
    const controller = new WorkbookController({ rows: { len: 2 }, cols: { len: 2 } });
    const sheet = controller.getSheetIds()[0]!;

    controller.dispatch({
      type: 'set-border',
      selection: selected(sheet, 0, 0, 1, 1),
      mode: mode as 'all',
      line,
    }, 'toolbar');

    const value = controller.getValue()[0]!;
    const borderAt = (row: string, column: string): CellBorders => {
      const rowData = value.rows?.[row] as {
        readonly cells?: Readonly<Record<string, { readonly style?: number }>>;
      } | undefined;
      const style = rowData?.cells?.[column]?.style;
      return style === undefined ? {} : value.styles?.[style]?.border ?? {};
    };
    expect([
      borderAt('0', '0'),
      borderAt('0', '1'),
      borderAt('1', '0'),
      borderAt('1', '1'),
    ]).toEqual(expected);
    expect(controller.historySize).toEqual({ undo: 1, redo: 0 });
  });

  it('border none removes only border and preserves the rest of the style', () => {
    const controller = new WorkbookController({
      styles: [{ color: 'red', vendor: false, border: { top: line } }],
      rows: { 0: { cells: { 0: { style: 0 } } } },
    });
    const sheet = controller.getSheetIds()[0]!;

    controller.dispatch({
      type: 'set-border', selection: selected(sheet, 0, 0), mode: 'none',
    }, 'toolbar');

    const value = controller.getValue()[0]!;
    expect(value.styles?.[1]).toEqual({ color: 'red', vendor: false });
    expect(value.rows?.['0']).toMatchObject({ cells: { 0: { style: 1 } } });
  });

  it('applies borders to merge anchors without materializing merged non-anchor cells', () => {
    const controller = new WorkbookController({
      merges: ['A1:B2'],
      rows: { len: 2, 0: { cells: { 0: { merge: [1, 1] } } } },
      cols: { len: 3 },
    });
    const sheet = controller.getSheetIds()[0]!;

    controller.dispatch({
      type: 'set-border', selection: selected(sheet, 0, 0, 1, 2), mode: 'outside', line,
    }, 'toolbar');

    const value = controller.getValue()[0]!;
    const row0 = value.rows?.['0'] as {
      readonly cells?: Readonly<Record<string, { readonly style?: number; readonly merge?: readonly number[] }>>;
    };
    const row1 = value.rows?.['1'] as {
      readonly cells?: Readonly<Record<string, { readonly style?: number; readonly merge?: readonly number[] }>>;
    };
    const anchor = row0.cells?.['0'];
    const topRight = row0.cells?.['2'];
    const bottomRight = row1.cells?.['2'];
    expect(value.styles?.[anchor?.style ?? -1]?.border).toEqual({
      top: line, bottom: line, left: line,
    });
    expect(value.styles?.[topRight?.style ?? -1]?.border).toEqual({ top: line, right: line });
    expect(value.styles?.[bottomRight?.style ?? -1]?.border).toEqual({
      right: line, bottom: line,
    });
    expect(row0.cells).not.toHaveProperty('1');
    expect(row1.cells).not.toHaveProperty('0');
    expect(row1.cells).not.toHaveProperty('1');
    expect(anchor?.merge).toEqual([1, 1]);
  });

  it('streams a large legal range and rejects oversized ranges before allocation', () => {
    const legal = new WorkbookController({ rows: { len: 200 }, cols: { len: 200 } });
    const legalSheet = legal.getSheetIds()[0]!;
    const started = performance.now();
    legal.dispatch({
      type: 'set-style',
      selection: selected(legalSheet, 0, 0, 199, 199),
      patch: { textwrap: true },
    }, 'toolbar');
    const duration = performance.now() - started;
    expect(duration).toBeLessThan(2_000);
    expect(legal.getValue()[0]!.styles).toEqual([{ textwrap: true }]);

    const oversized = new WorkbookController({ rows: { len: 1000 }, cols: { len: 1000 } });
    const oversizedSheet = oversized.getSheetIds()[0]!;
    expect(() => oversized.dispatch({
      type: 'set-style',
      selection: selected(oversizedSheet, 0, 0, 999, 999),
      patch: { textwrap: true },
    }, 'toolbar')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(oversized.historySize).toEqual({ undo: 0, redo: 0 });
  });

  it('keeps equal patches silent and rejects malformed style patches atomically', () => {
    const controller = new WorkbookController({
      styles: [{ font: { bold: true } }],
      rows: { 0: { cells: { 0: { text: 'safe', style: 0 } } } },
    });
    const sheet = controller.getSheetIds()[0]!;
    const before = controller.getValue();

    expect(controller.dispatch({
      type: 'set-style',
      selection: selected(sheet, 0, 0),
      patch: { font: { bold: true } },
    }, 'toolbar')).toEqual({ status: 'noop' });
    expect(() => controller.dispatch({
      type: 'set-style',
      selection: selected(sheet, 0, 0),
      patch: { align: 'diagonal' },
    } as never, 'toolbar')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.getValue()).toEqual(before);
    expect(controller.historySize).toEqual({ undo: 0, redo: 0 });
  });
});

describe('immutable style normalization and deduplication', () => {
  it('normalizes a deep clone without losing extension data or falsy values', () => {
    const style = {
      format: 'number',
      textwrap: false,
      font: { bold: false, vendorFont: { weight: 0 } },
      border: { top: ['thin', '#000'] as const, vendorBorder: 'keep' },
      vendorStyle: { nested: [false, 0, '', null] },
    } satisfies CellStyle;
    const before = structuredClone(style);
    const normalized = normalizeStyle(style);

    expect(normalized).toEqual(before);
    expect(style).toEqual(before);
    expect(normalized).not.toBe(style);
    expect(normalized.font).not.toBe(style.font);
    expect(normalized.vendorStyle).not.toBe(style.vendorStyle);
  });

  it('deduplicates semantically equal styles without mutating the style table', () => {
    const styles = Object.freeze([
      Object.freeze({ font: Object.freeze({ bold: true }), vendor: 'keep' }),
    ]) satisfies readonly CellStyle[];
    const found = addStyle(styles, { vendor: 'keep', font: { bold: true } });
    const added = addStyle(styles, { font: { italic: true }, vendor: 'new' });

    expect(found).toEqual({ styles, index: 0, added: false });
    expect(found.styles).toBe(styles);
    expect(added).toMatchObject({ index: 1, added: true });
    expect(added.styles).toEqual([
      { font: { bold: true }, vendor: 'keep' },
      { font: { italic: true }, vendor: 'new' },
    ]);
    expect(styles).toHaveLength(1);
  });

  it('preserves dangerous extension keys as own data without changing prototypes', () => {
    const style = JSON.parse(`{
      "__proto__": {"polluted": true},
      "constructor": {"vendor": "kept"},
      "font": {"bold": true, "__proto__": {"fontPolluted": true}}
    }`) as CellStyle;
    const equivalent = JSON.parse(`{
      "font": {"__proto__": {"fontPolluted": true}, "bold": true},
      "constructor": {"vendor": "kept"},
      "__proto__": {"polluted": true}
    }`) as CellStyle;

    const normalized = normalizeStyle(style);
    expect(Object.hasOwn(normalized, '__proto__')).toBe(true);
    expect(Object.hasOwn(normalized, 'constructor')).toBe(true);
    expect(Object.getPrototypeOf(normalized)).toBe(Object.prototype);
    expect(normalized.__proto__).toEqual({ polluted: true });
    expect(normalized.constructor).toEqual({ vendor: 'kept' });
    expect(Object.hasOwn(normalized.font as object, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(normalized.font as object)).toBe(Object.prototype);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(JSON.parse(JSON.stringify(style)));
    expect(stylesEqual(normalized, equivalent)).toBe(true);

    const result = addStyle([normalized], equivalent);
    expect(result).toMatchObject({ index: 0, added: false });
    expect(result.styles).toHaveLength(1);
  });
});
