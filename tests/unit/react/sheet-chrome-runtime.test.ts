import { describe, expect, it } from 'vitest';
import type { Selection, SheetData, SheetId } from '../../../src/core';
import { filterCommandSelection } from '../../../src/react/sheet-chrome-runtime';

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
});
