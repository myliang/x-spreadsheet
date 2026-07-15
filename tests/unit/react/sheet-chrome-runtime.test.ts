import { describe, expect, it } from 'vitest';
import type { Selection, SheetData, SheetId } from '../../../src/core';
import {
  filterCommandSelection,
  filterValuesForSelection,
} from '../../../src/react/sheet-chrome-runtime';

const sheetId = 'sheet-filter' as SheetId;

describe('filterCommandSelection', () => {
  it('keeps an existing autofilter range when applying a column filter from one cell', () => {
    const sheet: SheetData = {
      autofilter: { ref: 'A1:D60' },
    };
    const selection: Selection = {
      sheet: sheetId,
      active: { row: 1, column: 0 },
      range: {
        start: { row: 1, column: 0 },
        end: { row: 1, column: 0 },
      },
    };

    expect(filterCommandSelection(sheet, selection)).toEqual({
      sheet: sheetId,
      active: { row: 0, column: 0 },
      range: {
        start: { row: 0, column: 0 },
        end: { row: 59, column: 3 },
      },
    });
  });

  it('uses the core filter-item normalization for whitespace-only values', () => {
    const sheet: SheetData = {
      rows: {
        len: 4,
        0: { cells: { 0: { text: 'Header' } } },
        1: { cells: { 0: { text: '   ' } } },
        2: { cells: { 0: { text: '' } } },
        3: { cells: { 0: { text: 'value' } } },
      },
      cols: { len: 1 },
    };
    const selection: Selection = {
      sheet: sheetId,
      active: { row: 0, column: 0 },
      range: {
        start: { row: 0, column: 0 },
        end: { row: 3, column: 0 },
      },
    };

    expect(filterValuesForSelection(sheet, selection)).toEqual(['', 'value']);
  });
});
