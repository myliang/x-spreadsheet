import { describe, expect, it } from 'vitest';
import {
  assertCellAddress,
  assertCellPoint,
  assertCellRange,
  normalizeCellRange,
  sheetId,
} from '../../../src/core';
import type { CellAddress, CellRange } from '../../../src/core';
import { TegoSheetException } from '../../../src/index';
import type { TegoSheetError } from '../../../src/index';

describe('sheet identities', () => {
  it('brands non-empty string identities', () => {
    expect(sheetId('sheet-1')).toBe('sheet-1');
    expect(() => sheetId('')).toThrow('sheet id must be a non-empty string');
    expect(() => sheetId('   ')).toThrow('sheet id must be a non-empty string');
    expect(() => sheetId(1 as unknown as string)).toThrow(
      'sheet id must be a non-empty string',
    );
  });
});

describe('coordinate guards', () => {
  it('accepts zero-based points and addresses', () => {
    const address: CellAddress = { sheet: sheetId('sheet-1'), row: 0, column: 0 };

    expect(address.row).toBe(0);
    expect(() => assertCellPoint(address)).not.toThrow();
    expect(() => assertCellAddress(address)).not.toThrow();
  });

  it.each([
    [{ row: -1, column: 0 }, 'row must be a non-negative integer'],
    [{ row: 0.5, column: 0 }, 'row must be a non-negative integer'],
    [{ row: Number.NaN, column: 0 }, 'row must be a non-negative integer'],
    [{ row: Number.POSITIVE_INFINITY, column: 0 }, 'row must be a non-negative integer'],
    [{ row: 0, column: -1 }, 'column must be a non-negative integer'],
    [{ row: 0, column: 1.5 }, 'column must be a non-negative integer'],
    [{ row: 0, column: Number.NaN }, 'column must be a non-negative integer'],
    [{ row: 0, column: Number.NEGATIVE_INFINITY }, 'column must be a non-negative integer'],
    [{ row: '0', column: 0 }, 'row must be a non-negative integer'],
  ] as const)('rejects invalid point %o', (point, message) => {
    expect(() => assertCellPoint(point)).toThrow(message);
  });

  it('rejects non-object points and invalid address sheets', () => {
    expect(() => assertCellPoint(null)).toThrow('cell point must be an object');
    expect(() => assertCellPoint([])).toThrow('cell point must be an object');
    expect(() => assertCellAddress(null)).toThrow('cell address must be an object');
    expect(() => assertCellAddress({ sheet: '', row: 0, column: 0 })).toThrow(
      'sheet must be a non-empty string',
    );
    expect(() => assertCellAddress({ sheet: 'sheet-1', row: -1, column: 0 })).toThrow(
      'row must be a non-negative integer',
    );
  });

  it('normalizes ranges without mutating their inputs', () => {
    const input = Object.freeze({
      start: Object.freeze({ row: 5, column: 2 }),
      end: Object.freeze({ row: 1, column: 7 }),
    });
    const before = structuredClone(input);

    const normalized = normalizeCellRange(input);

    expect(normalized).toEqual({
      start: { row: 1, column: 2 },
      end: { row: 5, column: 7 },
    });
    expect(input).toEqual(before);
    expect(normalized).not.toBe(input);
    expect(normalized.start).not.toBe(input.start);
    expect(normalized.end).not.toBe(input.end);
    expect(() => assertCellRange(normalized)).not.toThrow();
  });

  it('rejects malformed, invalid, and non-normalized ranges', () => {
    expect(() => assertCellRange(null)).toThrow('cell range must be an object');
    expect(() => assertCellRange({ start: null, end: { row: 0, column: 0 } })).toThrow(
      'range start must be a cell point',
    );
    expect(() =>
      assertCellRange({ start: { row: 0, column: 0 }, end: null }),
    ).toThrow('range end must be a cell point');
    expect(() =>
      assertCellRange({ start: { row: 0, column: 0 }, end: { row: -1, column: 0 } }),
    ).toThrow('row must be a non-negative integer');
    expect(() =>
      assertCellRange({ start: { row: 1, column: 0 }, end: { row: 0, column: 2 } }),
    ).toThrow('cell range must be normalized from top-left to bottom-right');
    expect(() =>
      normalizeCellRange({ start: { row: 0, column: 0 }, end: { row: 0, column: Infinity } }),
    ).toThrow('column must be a non-negative integer');
  });

  it('recognizes a normalized inclusive range type', () => {
    const range: CellRange = {
      start: { row: 0, column: 0 },
      end: { row: 0, column: 0 },
    };

    expect(() => assertCellRange(range)).not.toThrow();
  });
});

describe('TegoSheetException', () => {
  it('carries a stable readonly spreadsheet error payload and cause', () => {
    const cause = new Error('invalid row data');
    const error: TegoSheetError = {
      code: 'INVALID_DATA',
      message: 'Workbook data is invalid',
      recoverable: false,
      cause,
    };

    const exception = new TegoSheetException(error);

    expect(exception).toBeInstanceOf(Error);
    expect(exception.name).toBe('TegoSheetException');
    expect(exception.message).toBe(error.message);
    expect(exception.code).toBe(error.code);
    expect(exception.error).toBe(error);
    expect(exception.cause).toBe(cause);
  });
});
