import { parseA1Reference, renderA1Reference } from '../coordinates/a1';
import type { CellData, CellsData, RowData, RowsData, SheetData } from '../types/workbook';
import { canonicalSparseIndex, cloneSheet } from './cells';
import { transformMergesForDelete, transformMergesForInsert } from './merges';

function assertIndex(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function collectionLength(rows: RowsData | undefined): number {
  const value = rows?.len ?? 100;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('row length must be a non-negative safe integer');
  }
  return value;
}

function inclusiveCount(start: number, end: number, label: string): number {
  const count = end - start + 1;
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError(`${label} count must be a positive safe integer`);
  }
  return count;
}

function nextLength(length: number, delta: number, label: string): number {
  const value = length + delta;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} length would be outside the safe non-negative range`);
  }
  return value;
}

function define(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function shiftFormula(
  formula: string,
  axis: 'row' | 'column',
  threshold: number,
  delta: number,
): string {
  if (!formula.startsWith('=')) return formula;
  let output = '';
  let index = 0;
  let quoted = false;

  while (index < formula.length) {
    const character = formula[index] as string;
    if (character === '"') {
      output += character;
      if (quoted && formula[index + 1] === '"') {
        output += '"';
        index += 2;
        continue;
      }
      quoted = !quoted;
      index += 1;
      continue;
    }

    if (!quoted) {
      const match = /^(\$?)([A-Z]+)(\$?)([1-9]\d*)/i.exec(formula.slice(index));
      if (match !== null) {
        const word = match[0];
        const before = formula[index - 1];
        const after = formula[index + word.length];
        const boundaryBefore = before === undefined || !/[A-Z0-9_$]/i.test(before);
        const boundaryAfter = after === undefined || !/[A-Z0-9_$]/i.test(after);
        if (boundaryBefore && boundaryAfter) {
          const reference = parseA1Reference(word.toUpperCase());
          const coordinate = axis === 'row' ? reference.row : reference.column;
          let rendered = coordinate < threshold
            ? word
            : renderA1Reference(axis === 'row'
              ? { ...reference, row: reference.row + delta }
              : { ...reference, column: reference.column + delta });
          const column = match[2] as string;
          if (coordinate >= threshold && column === column.toLowerCase()) {
            rendered = rendered.replace(/[A-Z]+/, letters => letters.toLowerCase());
          }
          output += rendered;
          index += word.length;
          continue;
        }
      }
    }

    output += character;
    index += 1;
  }
  return output;
}

export function shiftCellFormula(
  cell: CellData,
  axis: 'row' | 'column',
  threshold: number,
  delta: number,
): CellData {
  if (typeof cell.text !== 'string' || !cell.text.startsWith('=')) return cell;
  const text = shiftFormula(cell.text, axis, threshold, delta);
  if (text === cell.text) return cell;
  const updated = { ...cell } as Record<string, unknown>;
  updated.text = text;
  delete updated.value;
  return updated as CellData;
}

export function shiftRowFormulas(
  row: RowData,
  axis: 'row' | 'column',
  threshold: number,
  delta: number,
): RowData {
  if (row.cells === undefined) return row;
  const cells = { ...row.cells } as Record<string, unknown>;
  for (const [key, value] of Object.entries(cells)) {
    if (canonicalSparseIndex(key) === null
      || value === null || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const cell = value as CellData;
    cells[key] = shiftCellFormula(cell, axis, threshold, delta);
  }
  return { ...row, cells: cells as CellsData } as unknown as RowData;
}

export function getRowData(sheet: SheetData, row: number): RowData | null {
  assertIndex(row, 'row');
  const value = sheet.rows?.[String(row)];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RowData
    : null;
}

function updateRow(
  sheet: SheetData,
  row: number,
  updater: (value: RowData) => RowData,
): SheetData {
  assertIndex(row, 'row');
  const next = cloneSheet(sheet);
  const rows = { ...(next.rows ?? { len: 100 }) } as Record<string, unknown>;
  const current = getRowData(next, row) ?? {};
  rows[String(row)] = updater(current);
  return { ...next, rows: rows as RowsData } as unknown as SheetData;
}

export function setRowHeight(sheet: SheetData, row: number, height: number): SheetData {
  if (!Number.isFinite(height) || height < 0) {
    throw new RangeError('row height must be a non-negative finite number');
  }
  return updateRow(sheet, row, value => ({ ...value, height }) as unknown as RowData);
}

export function setRowHidden(sheet: SheetData, row: number, hidden: boolean): SheetData {
  return updateRow(sheet, row, value => {
    const next = { ...value } as Record<string, unknown>;
    if (hidden) next.hide = true;
    else delete next.hide;
    return next as RowData;
  });
}

export function insertRows(sheet: SheetData, index: number, count = 1): SheetData {
  assertIndex(index, 'row index');
  assertIndex(count, 'row count');
  if (count === 0) return sheet;
  const length = nextLength(collectionLength(sheet.rows), count, 'row');
  const next = cloneSheet(sheet);
  const source = { ...(next.rows ?? { len: 100 }) } as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  const boundary = BigInt(index);
  const delta = BigInt(count);

  for (const [key, value] of Object.entries(source)) {
    const numeric = canonicalSparseIndex(key);
    if (numeric === null) {
      define(output, key, key === 'len' ? length : value);
      continue;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
    const shifted = numeric >= boundary;
    const destination = shifted ? (numeric + delta).toString() : key;
    define(output, destination, shifted
      ? shiftRowFormulas(value as RowData, 'row', index, count)
      : value);
  }
  if (!Object.hasOwn(output, 'len')) output.len = length;
  return transformMergesForInsert(
    { ...next, rows: output as RowsData } as unknown as SheetData,
    'row',
    index,
    count,
  );
}

export function deleteRows(sheet: SheetData, start: number, end: number): SheetData {
  assertIndex(start, 'start row');
  assertIndex(end, 'end row');
  if (end < start) throw new RangeError('end row must not precede start row');
  const count = inclusiveCount(start, end, 'row deletion');
  const length = nextLength(collectionLength(sheet.rows), -count, 'row');
  const next = cloneSheet(sheet);
  const source = { ...(next.rows ?? { len: 100 }) } as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  const startKey = BigInt(start);
  const endKey = BigInt(end);
  const delta = BigInt(count);

  for (const [key, value] of Object.entries(source)) {
    const numeric = canonicalSparseIndex(key);
    if (numeric === null) {
      define(output, key, key === 'len' ? length : value);
      continue;
    }
    if (numeric >= startKey && numeric <= endKey) continue;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
    const shifted = numeric > endKey;
    const destination = shifted ? (numeric - delta).toString() : key;
    define(output, destination, shifted
      ? shiftRowFormulas(value as RowData, 'row', end + 1, -count)
      : value);
  }
  if (!Object.hasOwn(output, 'len')) output.len = length;
  return transformMergesForDelete(
    { ...next, rows: output as RowsData } as unknown as SheetData,
    'row',
    start,
    end,
  );
}
