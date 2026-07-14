import { describe, expect, it } from 'vitest';
import {
  WorkbookState,
  addMerge,
  addStyleToSheet,
  deleteColumns,
  deleteRows,
  findMerge,
  getCellData,
  insertColumns,
  insertRows,
  mergeIntersects,
  removeMerge,
  selectCell,
  selectCellStyle,
  selectWorkbookData,
  setCellStyleIndex,
  setCellText,
  setColumnHidden,
  setColumnWidth,
  setRowHeight,
  setRowHidden,
} from '../../../src/core';
import type { CellRange, CellStyle, SheetData, WorkbookInput } from '../../../src/core';

const range = (
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
): CellRange => ({
  start: { row: startRow, column: startColumn },
  end: { row: endRow, column: endColumn },
});

describe('immutable workbook state and runtime sheet identity', () => {
  it('keeps runtime IDs through internal updates and regenerates every ID on replacement', () => {
    const state = WorkbookState.from([{ name: 'A' }, { name: 'B' }]);
    const firstId = state.sheets[0]?.id;
    const secondId = state.sheets[1]?.id;
    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(firstId).not.toBe(secondId);

    const renamed = state.rename(firstId!, 'Renamed');
    expect(renamed.sheets[0]?.id).toBe(firstId);
    expect(renamed.sheets[1]?.id).toBe(secondId);
    expect(renamed.sheets[0]?.data.name).toBe('Renamed');

    const replaced = renamed.replace([{ name: 'Renamed' }, { name: 'B' }]);
    expect(replaced.sheets.map(sheet => sheet.id)).not.toContain(firstId);
    expect(replaced.sheets.map(sheet => sheet.id)).not.toContain(secondId);
  });

  it('parses and isolates frozen caller data while preserving recursive extensions and falsy cache', () => {
    const input = Object.freeze({
      name: '',
      rows: Object.freeze({
        len: 2,
        0: Object.freeze({
          cells: Object.freeze({
            0: Object.freeze({
              text: '',
              value: 0,
              editable: false,
              vendorCell: Object.freeze({ enabled: false }),
            }),
          }),
          vendorRow: '',
        }),
        vendorRows: Object.freeze([false, 0, '', null]),
      }),
      vendorSheet: Object.freeze({ nested: false }),
    }) satisfies WorkbookInput;

    const state = WorkbookState.from(input);
    const output = state.serialize();

    expect(output[0]).toMatchObject(input);
    expect(output[0]).not.toHaveProperty('id');
    expect(output[0]).not.toBe(input);
    expect(Object.isFrozen(state.sheets[0]?.data)).toBe(true);
    expect(() => state.rename(state.sheets[0]!.id, 'safe')).not.toThrow();
    expect(input.name).toBe('');
  });

  it('supports an empty workbook and immutable add, rename, update, and delete lifecycles', () => {
    const empty = WorkbookState.from([]);
    expect(empty.sheets).toEqual([]);

    const added = empty.add('Only');
    const id = added.sheets[0]!.id;
    const updated = added.update(
      id,
      sheet => ({ ...sheet, vendor: { kept: true } }) as unknown as SheetData,
    );
    const renamed = updated.rename(id, 'Final');
    const deleted = renamed.delete(id);

    expect(updated.sheets[0]?.id).toBe(id);
    expect(renamed.serialize()[0]).toMatchObject({ name: 'Final', vendor: { kept: true } });
    expect(deleted.sheets).toEqual([]);
    expect(() => deleted.rename(id, 'stale')).toThrow(/Unknown sheet ID/);
  });

  it('returns cloned serialized and selector outputs', () => {
    const state = WorkbookState.from({ rows: { 0: { cells: { 0: { text: 'A' } } } } });
    const one = selectWorkbookData(state);
    const two = selectWorkbookData(state);
    const cell = selectCell(state.sheets[0]!.data, 0, 0);

    expect(one).toEqual(two);
    expect(one).not.toBe(two);
    expect(one[0]).not.toBe(two[0]);
    expect(cell).toEqual({ text: 'A' });
    expect(cell).not.toBe(getCellData(state.sheets[0]!.data, 0, 0));
  });
});

describe('sparse row, column, and cell model helpers', () => {
  const structuredSheet = (): SheetData => WorkbookState.from({
    name: 'Sparse',
    merges: ['A1:B2'],
    rows: {
      len: 4,
      0: { cells: { 0: { text: 'top', merge: [1, 1] }, 1: { text: 'drop' } } },
      2: { height: 0, hide: false, cells: { 1: { text: '=B3', value: 'cached' } } },
      vendorRows: { falsy: false },
    },
    cols: {
      len: 4,
      2: { width: 0, hide: false, vendorColumn: '' },
      vendorCols: [0, false],
    },
  }).sheets[0]!.data;

  it('inserts and deletes rows with sparse metadata, formula references, lengths, and merge transforms', () => {
    const source = structuredSheet();
    const inserted = insertRows(source, 1, 2);

    expect(inserted.rows).toMatchObject({
      len: 6,
      4: { height: 0, hide: false, cells: { 1: { text: '=B5' } } },
      vendorRows: { falsy: false },
    });
    expect(inserted.merges).toEqual(['A1:B4']);
    expect(getCellData(inserted, 4, 1)).not.toHaveProperty('value');

    const deleted = deleteRows(inserted, 1, 2);
    expect(deleted.rows).toMatchObject({ len: 4, 2: { cells: { 1: { text: '=B3' } } } });
    expect(deleted.merges).toEqual(['A1:B2']);
    expect(source.rows).toMatchObject({ len: 4, 2: { cells: { 1: { text: '=B3' } } } });
  });

  it('inserts and deletes columns with sparse metadata, formula references, lengths, and merge transforms', () => {
    const source = structuredSheet();
    const inserted = insertColumns(source, 1, 2);

    expect(inserted.cols).toMatchObject({
      len: 6,
      4: { width: 0, hide: false, vendorColumn: '' },
      vendorCols: [0, false],
    });
    expect(getCellData(inserted, 2, 3)).toMatchObject({ text: '=D3' });
    expect(inserted.merges).toEqual(['A1:D2']);

    const deleted = deleteColumns(inserted, 1, 2);
    expect(deleted.cols).toMatchObject({ len: 4, 2: { width: 0 } });
    expect(getCellData(deleted, 2, 1)).toMatchObject({ text: '=B3' });
    expect(deleted.merges).toEqual(['A1:B2']);
  });

  it('shifts every row reference marker combination without touching quotes or identifiers', () => {
    const formula = '=$A1+A$1+$A$1+A1+AAAA1:B2+C3+b2+"A1"+A1foo+_A1+A1_2';
    const source = WorkbookState.from({
      rows: { 1: { cells: { 0: { text: formula, value: 'cached' } } } },
    }).sheets[0]!.data;

    const inserted = insertRows(source, 0, 2);
    expect(getCellData(inserted, 3, 0)).toEqual({
      text: '=$A3+A$3+$A$3+A3+AAAA3:B4+C5+b4+"A1"+A1foo+_A1+A1_2',
    });

    const deleted = deleteRows(inserted, 0, 1);
    expect(getCellData(deleted, 1, 0)).toEqual({ text: formula });
  });

  it('shifts every column reference marker combination and arbitrary-length columns safely', () => {
    const formula = '=$A1+A$1+$A$1+A1+AAAA1:AAAB2+C3+b2+"A1"+A1foo+_A1+A1_2';
    const source = WorkbookState.from({
      rows: { 0: { cells: { 1: { text: formula, value: false } } } },
    }).sheets[0]!.data;

    const inserted = insertColumns(source, 0, 2);
    expect(getCellData(inserted, 0, 3)).toEqual({
      text: '=$C1+C$1+$C$1+C1+AAAC1:AAAD2+E3+d2+"A1"+A1foo+_A1+A1_2',
    });

    const deleted = deleteColumns(inserted, 0, 1);
    expect(getCellData(deleted, 0, 1)).toEqual({ text: formula });
  });

  it('keeps references into deleted regions while shifting references after the boundary', () => {
    const rowSource = WorkbookState.from({
      rows: { 3: { cells: { 0: { text: '=A1+A3+A4', value: 0 } } } },
    }).sheets[0]!.data;
    const columnSource = WorkbookState.from({
      rows: { 0: { cells: { 3: { text: '=A1+C1+D1', value: '' } } } },
    }).sheets[0]!.data;

    expect(getCellData(deleteRows(rowSource, 1, 2), 1, 0)).toEqual({
      text: '=A1+A3+A2',
    });
    expect(getCellData(deleteColumns(columnSource, 1, 2), 0, 1)).toEqual({
      text: '=A1+C1+B1',
    });
  });

  it('resizes and hides rows and columns without dropping false, zero, or extension data', () => {
    const source = structuredSheet();
    const next = setColumnHidden(
      setColumnWidth(setRowHidden(setRowHeight(source, 2, 18), 2, true), 2, 88),
      2,
      true,
    );
    const restored = setColumnHidden(setRowHidden(next, 2, false), 2, false);

    expect(next.rows?.['2']).toMatchObject({ height: 18, hide: true });
    expect(next.cols?.['2']).toMatchObject({ width: 88, hide: true, vendorColumn: '' });
    expect(restored.rows?.['2']).toMatchObject({ height: 18, hide: false });
    expect(restored.cols?.['2']).toMatchObject({ width: 88, hide: false });
  });

  it('sets text immutably, respects editable false, and invalidates only derived cell cache', () => {
    const source = WorkbookState.from({
      rows: {
        0: { cells: { 0: { text: 'old', value: 0, style: 0, vendor: false } } },
        1: { cells: { 0: { text: 'locked', editable: false, value: '' } } },
      },
    }).sheets[0]!.data;
    const changed = setCellText(source, 0, 0, 'new');
    const locked = setCellText(changed, 1, 0, 'ignored');
    const styled = setCellStyleIndex(changed, 0, 0, 2);

    expect(getCellData(changed, 0, 0)).toEqual({ text: 'new', style: 0, vendor: false });
    expect(getCellData(locked, 1, 0)).toEqual({ text: 'locked', editable: false, value: '' });
    expect(getCellData(styled, 0, 0)).toEqual({ text: 'new', style: 2, vendor: false });
    expect(getCellData(source, 0, 0)).toHaveProperty('value', 0);
  });

  it('shifts arbitrary-size sparse indexes and preserves dangerous extension keys as data', () => {
    const rowKey = '900719925474099312345678901234567890';
    const columnKey = '800719925474099312345678901234567891';
    const input = JSON.parse(`{
      "rows": {
        "len": 2,
        "${rowKey}": {"cells": {}},
        "__proto__": {"rowExtension": false}
      },
      "cols": {
        "len": 2,
        "${columnKey}": {"width": 0},
        "__proto__": {"columnExtension": false}
      }
    }`) as WorkbookInput;
    const source = WorkbookState.from(input).sheets[0]!.data;
    const rowsShifted = insertRows(source, 0, 2);
    const shifted = insertColumns(rowsShifted, 0, 3);

    expect(Object.hasOwn(shifted.rows as object, '__proto__')).toBe(true);
    expect(Object.hasOwn(shifted.cols as object, '__proto__')).toBe(true);
    expect(shifted.rows?.[(BigInt(rowKey) + 2n).toString()]).toEqual({ cells: {} });
    expect(shifted.cols?.[(BigInt(columnKey) + 3n).toString()]).toEqual({ width: 0 });
    expect(({} as { rowExtension?: boolean }).rowExtension).toBeUndefined();
    expect(({} as { columnExtension?: boolean }).columnExtension).toBeUndefined();
  });
});

describe('styles and merges', () => {
  it('deduplicates styles at sheet scope and selects an isolated deep cascade', () => {
    const defaultStyle = { color: 'black', font: { name: 'Arial', bold: false } } satisfies CellStyle;
    const source = WorkbookState.from({
      styles: [
        { color: 'blue', font: { bold: true }, vendor: { row: false } },
        { bgcolor: 'red', font: { italic: true } },
      ],
      rows: { 1: { style: 0, cells: { 2: { style: 1 } } } },
      cols: { 2: { style: 0 } },
    }).sheets[0]!.data;
    const found = addStyleToSheet(source, { font: { bold: true }, color: 'blue', vendor: { row: false } });
    const added = addStyleToSheet(source, { underline: false, vendor: { new: 0 } });
    const selected = selectCellStyle(source, 1, 2, defaultStyle);

    expect(found).toMatchObject({ index: 0, added: false });
    expect(found.sheet).toBe(source);
    expect(added).toMatchObject({ index: 2, added: true });
    expect(added.sheet.styles).toHaveLength(3);
    expect(selected).toEqual({
      color: 'blue',
      bgcolor: 'red',
      font: { name: 'Arial', bold: true, italic: true },
      vendor: { row: false },
    });
    expect(selected).not.toBe(source.styles?.[1]);
  });

  it('adds, queries, rejects overlap, and removes normalized merges with synchronized anchor metadata', () => {
    const source = WorkbookState.from({ rows: { 0: { cells: { 0: { text: 'keep' } } } } })
      .sheets[0]!.data;
    const merged = addMerge(source, range(0, 0, 1, 2));

    expect(merged.merges).toEqual(['A1:C2']);
    expect(getCellData(merged, 0, 0)).toMatchObject({ text: 'keep', merge: [1, 2] });
    expect(findMerge(merged, 1, 1)).toEqual(range(0, 0, 1, 2));
    expect(mergeIntersects(merged, range(1, 2, 3, 4))).toBe(true);
    expect(() => addMerge(merged, range(1, 1, 2, 2))).toThrow(/overlaps/i);

    const unmerged = removeMerge(merged, range(1, 1, 1, 1));
    expect(unmerged.merges).toEqual([]);
    expect(getCellData(unmerged, 0, 0)).toEqual({ text: 'keep' });
  });
});
