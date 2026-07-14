import type {
  CellData,
  CellsData,
  ColsData,
  ColumnData,
  RowData,
  RowsData,
  SheetData,
} from '../types/workbook';
import { cloneSheet } from './cells';
import { transformMergesForDelete, transformMergesForInsert } from './merges';
import { shiftCellFormula } from './rows';

function assertIndex(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function numericKey(key: string): bigint | null {
  return /^\d+$/.test(key) ? BigInt(key) : null;
}

function define(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function getColumnData(sheet: SheetData, column: number): ColumnData | null {
  assertIndex(column, 'column');
  const value = sheet.cols?.[String(column)];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as ColumnData
    : null;
}

function updateColumn(
  sheet: SheetData,
  column: number,
  updater: (value: ColumnData) => ColumnData,
): SheetData {
  assertIndex(column, 'column');
  const next = cloneSheet(sheet);
  const cols = { ...(next.cols ?? { len: 26 }) } as Record<string, unknown>;
  const current = getColumnData(next, column) ?? {};
  cols[String(column)] = updater(current);
  return { ...next, cols: cols as ColsData } as unknown as SheetData;
}

export function setColumnWidth(sheet: SheetData, column: number, width: number): SheetData {
  if (!Number.isFinite(width) || width < 0) {
    throw new RangeError('column width must be a non-negative finite number');
  }
  return updateColumn(sheet, column, value => ({ ...value, width }));
}

export function setColumnHidden(sheet: SheetData, column: number, hidden: boolean): SheetData {
  return updateColumn(sheet, column, value => ({ ...value, hide: hidden }));
}

function transformRowCells(
  row: RowData,
  start: number,
  end: number | null,
  delta: number,
): RowData {
  if (row.cells === undefined) return row;
  const output: Record<string, unknown> = {};
  const startKey = BigInt(start);
  const endKey = end === null ? null : BigInt(end);
  const shift = BigInt(Math.abs(delta));
  for (const [key, value] of Object.entries(row.cells)) {
    const numeric = numericKey(key);
    if (numeric === null) {
      define(output, key, value);
      continue;
    }
    if (endKey !== null && numeric >= startKey && numeric <= endKey) continue;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
    const shouldShift = endKey === null ? numeric >= startKey : numeric > endKey;
    const destination = shouldShift
      ? (delta > 0 ? numeric + shift : numeric - shift).toString()
      : key;
    define(output, destination, shouldShift
      ? shiftCellFormula(
        value as CellData,
        'column',
        endKey === null ? start : (end as number) + 1,
        delta,
      )
      : value);
  }
  return { ...row, cells: output as CellsData } as unknown as RowData;
}

function transformAllRows(
  rows: RowsData,
  start: number,
  end: number | null,
  delta: number,
): RowsData {
  const output = { ...rows } as Record<string, unknown>;
  for (const [key, value] of Object.entries(output)) {
    if (!/^\d+$/.test(key) || value === null || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    output[key] = transformRowCells(value as RowData, start, end, delta);
  }
  return output as RowsData;
}

export function insertColumns(sheet: SheetData, index: number, count = 1): SheetData {
  assertIndex(index, 'column index');
  assertIndex(count, 'column count');
  if (count === 0) return sheet;
  const next = cloneSheet(sheet);
  const source = { ...(next.cols ?? { len: 26 }) } as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  const boundary = BigInt(index);
  const delta = BigInt(count);
  for (const [key, value] of Object.entries(source)) {
    const numeric = numericKey(key);
    if (numeric === null) {
      define(output, key, key === 'len' && typeof value === 'number' ? value + count : value);
      continue;
    }
    define(output, numeric >= boundary ? (numeric + delta).toString() : key, value);
  }
  if (!Object.hasOwn(output, 'len')) output.len = 26 + count;
  const rows = transformAllRows(next.rows ?? { len: 100 }, index, null, count);
  return transformMergesForInsert(
    { ...next, cols: output as ColsData, rows } as unknown as SheetData,
    'column',
    index,
    count,
  );
}

export function deleteColumns(sheet: SheetData, start: number, end: number): SheetData {
  assertIndex(start, 'start column');
  assertIndex(end, 'end column');
  if (end < start) throw new RangeError('end column must not precede start column');
  const count = end - start + 1;
  const next = cloneSheet(sheet);
  const source = { ...(next.cols ?? { len: 26 }) } as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  const startKey = BigInt(start);
  const endKey = BigInt(end);
  const delta = BigInt(count);
  for (const [key, value] of Object.entries(source)) {
    const numeric = numericKey(key);
    if (numeric === null) {
      define(output, key, key === 'len' && typeof value === 'number'
        ? Math.max(0, value - count)
        : value);
      continue;
    }
    if (numeric >= startKey && numeric <= endKey) continue;
    define(output, numeric > endKey ? (numeric - delta).toString() : key, value);
  }
  if (!Object.hasOwn(output, 'len')) output.len = Math.max(0, 26 - count);
  const rows = transformAllRows(next.rows ?? { len: 100 }, start, end, -count);
  return transformMergesForDelete(
    { ...next, cols: output as ColsData, rows } as unknown as SheetData,
    'column',
    start,
    end,
  );
}
