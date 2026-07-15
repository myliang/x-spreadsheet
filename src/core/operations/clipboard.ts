import {
  containsRange,
  parseA1Range,
  rangeSize,
  rangesIntersect,
  renderA1Range,
} from '../coordinates/ranges';
import { cloneSheet, getCellData } from '../model/cells';
import { mergeIntersects, synchronizeMergeAnchors } from '../model/merges';
import { addStyle } from '../model/styles';
import { semanticEqual } from '../serialization/semantic-equal';
import type { CellRange } from '../types/coordinates';
import type { CellData, CellStyle, SheetData } from '../types/workbook';
import { assertRangeEditable } from './editable';

export type PasteMode = 'all' | 'value' | 'format';

export const MAX_CLIPBOARD_CELLS = 250_000;

export interface PasteTransform {
  readonly sheet: SheetData;
  readonly range: CellRange;
  readonly values: readonly (readonly string[])[];
}

function area(range: CellRange): bigint {
  return (BigInt(range.end.row) - BigInt(range.start.row) + 1n)
    * (BigInt(range.end.column) - BigInt(range.start.column) + 1n);
}

export function assertClipboardResourceLimit(range: CellRange): void {
  if (area(range) > BigInt(MAX_CLIPBOARD_CELLS)) {
    throw new RangeError(`clipboard range exceeds the ${MAX_CLIPBOARD_CELLS}-cell operation limit`);
  }
}

export function assertPasteMergeCompatibility(
  targetSheet: SheetData,
  sourceSheet: SheetData | null,
  source: CellRange | null,
  target: CellRange,
): void {
  if (mergeIntersects(targetSheet, target)) {
    throw new RangeError('paste target intersects a merged range');
  }
  if (sourceSheet === null || source === null) return;
  for (const raw of sourceSheet.merges ?? []) {
    const merge = parseA1Range(raw);
    if (rangesIntersect(source, merge) && !containsRange(source, merge)) {
      throw new RangeError('paste source only partially contains a merged range');
    }
  }
}

function expandedRange(source: CellRange, target: CellRange): CellRange {
  const [sourceRows, sourceColumns] = rangeSize(source);
  const [targetRows, targetColumns] = rangeSize(target);
  const rows = Math.max(sourceRows, targetRows);
  const columns = Math.max(sourceColumns, targetColumns);
  const endRow = BigInt(target.start.row) + BigInt(rows) - 1n;
  const endColumn = BigInt(target.start.column) + BigInt(columns) - 1n;
  if (endRow > BigInt(Number.MAX_SAFE_INTEGER) || endColumn > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('expanded clipboard range exceeds safe coordinates');
  }
  return {
    start: target.start,
    end: { row: Number(endRow), column: Number(endColumn) },
  };
}

export function internalPasteRange(
  source: CellRange,
  target: CellRange,
  cut = false,
): CellRange {
  return expandedRange(source, cut ? { start: target.start, end: target.start } : target);
}

export function externalPasteRange(
  target: CellRange,
  values: readonly (readonly string[])[],
): CellRange {
  const rows = Math.max(1, values.length);
  const columns = Math.max(1, ...values.map(row => row.length));
  const endRow = BigInt(target.start.row) + BigInt(rows) - 1n;
  const endColumn = BigInt(target.start.column) + BigInt(columns) - 1n;
  if (endRow > BigInt(Number.MAX_SAFE_INTEGER) || endColumn > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('external clipboard matrix exceeds safe coordinates');
  }
  return {
    start: target.start,
    end: { row: Number(endRow), column: Number(endColumn) },
  };
}

export function parseClipboardMatrix(text: string): readonly (readonly string[])[] {
  const normalized = text.replace(/\r\n?/g, '\n');
  const rows = normalized.split('\n');
  if (rows.length > 1 && rows[rows.length - 1] === '') rows.pop();
  return rows.map(row => row.split('\t'));
}

export function clipboardMatrix(
  sheet: SheetData,
  range: CellRange,
): readonly (readonly string[])[] {
  assertClipboardResourceLimit(range);
  const output: string[][] = [];
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    const values: string[] = [];
    for (let column = range.start.column; column <= range.end.column; column += 1) {
      values.push(getCellData(sheet, row, column)?.text ?? '');
    }
    output.push(values);
  }
  return output;
}

function rowRecord(sheet: SheetData, row: number, create: boolean): Record<string, unknown> | null {
  const mutable = sheet as Record<string, unknown>;
  let rows = mutable.rows;
  if (rows === null || typeof rows !== 'object' || Array.isArray(rows)) {
    if (!create) return null;
    rows = { len: 100 };
    mutable.rows = rows;
  }
  const records = rows as Record<string, unknown>;
  let value = records[String(row)];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    if (!create) return null;
    value = {};
    records[String(row)] = value;
  }
  return value as Record<string, unknown>;
}

function cellsRecord(sheet: SheetData, row: number, create: boolean): Record<string, unknown> | null {
  const record = rowRecord(sheet, row, create);
  if (record === null) return null;
  let cells = record.cells;
  if (cells === null || typeof cells !== 'object' || Array.isArray(cells)) {
    if (!create) return null;
    cells = {};
    record.cells = cells;
  }
  return cells as Record<string, unknown>;
}

function assignCell(
  sheet: SheetData,
  row: number,
  column: number,
  source: CellData | null,
  mode: PasteMode,
  sourceStyles: readonly CellStyle[],
): void {
  if (source === null) {
    if (mode === 'value') return;
    const cells = cellsRecord(sheet, row, false);
    if (cells === null) return;
    if (mode === 'all') {
      delete cells[String(column)];
      return;
    }
    const currentValue = cells[String(column)];
    if (currentValue === null || typeof currentValue !== 'object' || Array.isArray(currentValue)) return;
    const next = { ...currentValue as Record<string, unknown> };
    delete next.style;
    delete next.merge;
    cells[String(column)] = next;
    return;
  }
  const cells = cellsRecord(sheet, row, true)!;
  const currentValue = cells[String(column)];
  const current = currentValue !== null && typeof currentValue === 'object' && !Array.isArray(currentValue)
    ? currentValue as Record<string, unknown>
    : {};

  if (mode === 'all') {
    const next = structuredClone(source) as Record<string, unknown>;
    if (source.style !== undefined) {
      const style = sourceStyles[source.style];
      if (style !== undefined) {
        const result = addStyle(sheet.styles ?? [], style);
        (sheet as Record<string, unknown>).styles = result.styles;
        next.style = result.index;
      }
    }
    cells[String(column)] = next;
    return;
  }

  if (mode === 'value') {
    const next = { ...current };
    if (Object.hasOwn(source, 'text')) next.text = source.text;
    else delete next.text;
    delete next.value;
    cells[String(column)] = next;
    return;
  }

  const next = { ...current };
  delete next.style;
  delete next.merge;
  if (source.style !== undefined) {
    const style = sourceStyles[source.style];
    if (style !== undefined) {
      const result = addStyle(sheet.styles ?? [], style);
      (sheet as Record<string, unknown>).styles = result.styles;
      next.style = result.index;
    }
  }
  if (source.merge !== undefined) next.merge = [...source.merge];
  cells[String(column)] = next;
}

function removeCell(sheet: SheetData, row: number, column: number): void {
  const cells = cellsRecord(sheet, row, false);
  if (cells !== null) delete cells[String(column)];
}

function translatedMerges(
  sourceSheet: SheetData,
  source: CellRange,
  target: CellRange,
): readonly string[] {
  const [sourceRows, sourceColumns] = rangeSize(source);
  const output: string[] = [];
  for (let row = target.start.row; row <= target.end.row; row += sourceRows) {
    for (let column = target.start.column; column <= target.end.column; column += sourceColumns) {
      for (const raw of sourceSheet.merges ?? []) {
        const merge = parseA1Range(raw);
        if (merge.start.row < source.start.row || merge.end.row > source.end.row
          || merge.start.column < source.start.column || merge.end.column > source.end.column) continue;
        const shifted = {
          start: {
            row: row + merge.start.row - source.start.row,
            column: column + merge.start.column - source.start.column,
          },
          end: {
            row: row + merge.end.row - source.start.row,
            column: column + merge.end.column - source.start.column,
          },
        };
        if (shifted.end.row <= target.end.row && shifted.end.column <= target.end.column) {
          output.push(renderA1Range(shifted));
        }
      }
    }
  }
  return output;
}

export function pasteInternal(
  targetSheet: SheetData,
  sourceSheet: SheetData,
  source: CellRange,
  target: CellRange,
  mode: PasteMode,
  cut = false,
  captureValues = true,
): PasteTransform {
  const range = internalPasteRange(source, target, cut);
  assertClipboardResourceLimit(source);
  assertClipboardResourceLimit(range);
  assertPasteMergeCompatibility(targetSheet, sourceSheet, source, range);
  assertRangeEditable(targetSheet, range);
  if (cut) assertRangeEditable(sourceSheet, source);
  const [sourceRows, sourceColumns] = rangeSize(source);
  const snapshots = new Map<string, CellData | null>();
  for (let row = source.start.row; row <= source.end.row; row += 1) {
    for (let column = source.start.column; column <= source.end.column; column += 1) {
      snapshots.set(`${row}:${column}`, getCellData(sourceSheet, row, column));
    }
  }
  const next = cloneSheet(targetSheet);
  if (cut && sourceSheet === targetSheet) {
    for (let row = source.start.row; row <= source.end.row; row += 1) {
      for (let column = source.start.column; column <= source.end.column; column += 1) {
        removeCell(next, row, column);
      }
    }
  }
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    for (let column = range.start.column; column <= range.end.column; column += 1) {
      const sourceRow = source.start.row + ((row - range.start.row) % sourceRows);
      const sourceColumn = source.start.column + ((column - range.start.column) % sourceColumns);
      const sourceCell = snapshots.get(`${sourceRow}:${sourceColumn}`) ?? null;
      if (cut && sourceCell === null) continue;
      assignCell(
        next,
        row,
        column,
        sourceCell,
        mode,
        sourceSheet.styles ?? [],
      );
    }
  }
  if (mode !== 'value') {
    const retained = (next.merges ?? []).filter(raw => {
      const merge = parseA1Range(raw);
      return merge.end.row < range.start.row || merge.start.row > range.end.row
        || merge.end.column < range.start.column || merge.start.column > range.end.column;
    });
    const sourceRetained = cut && sourceSheet === targetSheet
      ? retained.filter(raw => {
        const merge = parseA1Range(raw);
        return merge.end.row < source.start.row || merge.start.row > source.end.row
          || merge.end.column < source.start.column || merge.start.column > source.end.column;
      })
      : retained;
    (next as Record<string, unknown>).merges = [
      ...sourceRetained,
      ...translatedMerges(sourceSheet, source, range),
    ];
  }
  const synchronized = mode === 'value' ? next : synchronizeMergeAnchors(next);
  return {
    sheet: semanticEqual(synchronized, targetSheet) ? targetSheet : synchronized,
    range,
    values: captureValues ? clipboardMatrix(sourceSheet, source) : [],
  };
}

export function pasteExternal(
  sheet: SheetData,
  target: CellRange,
  values: readonly (readonly string[])[],
  captureValues = true,
): PasteTransform {
  const range = externalPasteRange(target, values);
  assertClipboardResourceLimit(range);
  assertPasteMergeCompatibility(sheet, null, null, range);
  assertRangeEditable(sheet, range);
  const next = cloneSheet(sheet);
  const normalized = values.length === 0 ? [['']] : values;
  for (let row = 0; row < normalized.length; row += 1) {
    const sourceRow = normalized[row] ?? [];
    const columns = range.end.column - range.start.column + 1;
    for (let column = 0; column < columns; column += 1) {
      assignCell(next, range.start.row + row, range.start.column + column, {
        text: sourceRow[column] ?? '',
      }, 'value', []);
    }
  }
  return {
    sheet: semanticEqual(next, sheet) ? sheet : next,
    range,
    values: captureValues ? normalized.map(row => [...row]) : [],
  };
}
