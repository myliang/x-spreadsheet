import { parseA1Range, renderA1Range } from '../coordinates/ranges';
import type { CellPoint, CellRange } from '../types/coordinates';
import type { CellData, CellsData, RowData, RowsData, SheetData } from '../types/workbook';
import { containsCell, normalizeRange, rangesEqual, rangesIntersect } from '../coordinates/ranges';
import { canonicalSparseIndex, cloneSheet } from './cells';

type Axis = 'row' | 'column';

function shiftPoint(point: CellPoint, axis: Axis, delta: number): CellPoint {
  return axis === 'row'
    ? { row: point.row + delta, column: point.column }
    : { row: point.row, column: point.column + delta };
}

function coordinate(point: CellPoint, axis: Axis): number {
  return axis === 'row' ? point.row : point.column;
}

function replaceCoordinate(point: CellPoint, axis: Axis, value: number): CellPoint {
  return axis === 'row'
    ? { row: value, column: point.column }
    : { row: point.row, column: value };
}

function parsedMerges(sheet: SheetData): readonly CellRange[] {
  return (sheet.merges ?? []).map(parseA1Range);
}

function withMergeList(sheet: SheetData, ranges: readonly CellRange[]): SheetData {
  return synchronizeMergeAnchors({
    ...cloneSheet(sheet),
    merges: ranges.map(renderA1Range),
  } as unknown as SheetData);
}

export function findMerge(sheet: SheetData, row: number, column: number): CellRange | null {
  return parsedMerges(sheet).find(range => containsCell(range, { row, column })) ?? null;
}

export function mergeIntersects(sheet: SheetData, range: CellRange): boolean {
  const normalized = normalizeRange(range);
  return parsedMerges(sheet).some(merge => rangesIntersect(merge, normalized));
}

export function addMerge(sheet: SheetData, range: CellRange): SheetData {
  const normalized = normalizeRange(range);
  if (normalized.start.row === normalized.end.row
    && normalized.start.column === normalized.end.column) return sheet;
  const merges = parsedMerges(sheet);
  if (merges.some(merge => rangesEqual(merge, normalized))) return sheet;
  if (merges.some(merge => rangesIntersect(merge, normalized))) {
    throw new RangeError('Merge overlaps an existing merged range');
  }

  const next = removeStoredNonAnchorCells(sheet, normalized);
  return withMergeList(next, [...merges, normalized]);
}

function removeStoredNonAnchorCells(sheet: SheetData, range: CellRange): SheetData {
  const next = cloneSheet(sheet);
  const rows = { ...(next.rows ?? { len: 100 }) } as Record<string, unknown>;
  const startRow = BigInt(range.start.row);
  const endRow = BigInt(range.end.row);
  const startColumn = BigInt(range.start.column);
  const endColumn = BigInt(range.end.column);

  for (const [rowKey, rowValue] of Object.entries(rows)) {
    const rowIndex = canonicalSparseIndex(rowKey);
    if (rowIndex === null || rowIndex < startRow || rowIndex > endRow
      || rowValue === null || typeof rowValue !== 'object' || Array.isArray(rowValue)) continue;
    const row = { ...rowValue } as Record<string, unknown>;
    const cellsValue = row.cells;
    if (cellsValue === null || typeof cellsValue !== 'object' || Array.isArray(cellsValue)) continue;
    const cells = { ...cellsValue } as Record<string, unknown>;
    for (const cellKey of Object.keys(cells)) {
      const columnIndex = canonicalSparseIndex(cellKey);
      if (columnIndex === null || columnIndex < startColumn || columnIndex > endColumn) continue;
      const anchor = rowIndex === startRow && columnIndex === startColumn;
      if (!anchor) delete cells[cellKey];
    }
    row.cells = cells as CellsData;
    rows[rowKey] = row as RowData;
  }
  return { ...next, rows: rows as RowsData } as unknown as SheetData;
}

export function removeMerge(sheet: SheetData, range: CellRange): SheetData {
  const normalized = normalizeRange(range);
  const merges = parsedMerges(sheet);
  const remaining = merges.filter(merge => !rangesIntersect(merge, normalized));
  return remaining.length === merges.length ? sheet : withMergeList(sheet, remaining);
}

export function transformMergesForInsert(
  sheet: SheetData,
  axis: Axis,
  index: number,
  count: number,
): SheetData {
  const ranges = parsedMerges(sheet).map(range => {
    const start = coordinate(range.start, axis);
    const end = coordinate(range.end, axis);
    if (start >= index) {
      return {
        start: shiftPoint(range.start, axis, count),
        end: shiftPoint(range.end, axis, count),
      };
    }
    if (start < index && index <= end) {
      return { start: range.start, end: shiftPoint(range.end, axis, count) };
    }
    return range;
  });
  return withMergeList(sheet, ranges);
}

export function transformMergesForDelete(
  sheet: SheetData,
  axis: Axis,
  startIndex: number,
  endIndex: number,
): SheetData {
  const count = endIndex - startIndex + 1;
  const ranges = parsedMerges(sheet).flatMap(range => {
    const start = coordinate(range.start, axis);
    const end = coordinate(range.end, axis);
    if (end < startIndex) return [range];
    if (start > endIndex) {
      return [{
        start: shiftPoint(range.start, axis, -count),
        end: shiftPoint(range.end, axis, -count),
      }];
    }

    const keepsBefore = start < startIndex;
    const keepsAfter = end > endIndex;
    if (!keepsBefore && !keepsAfter) return [];
    const nextStart = keepsBefore ? start : startIndex;
    const nextEnd = keepsAfter ? end - count : startIndex - 1;
    if (nextEnd < nextStart) return [];
    return [{
      start: replaceCoordinate(range.start, axis, nextStart),
      end: replaceCoordinate(range.end, axis, nextEnd),
    }];
  });
  return withMergeList(sheet, ranges);
}

export function synchronizeMergeAnchors(sheet: SheetData): SheetData {
  const next = cloneSheet(sheet);
  const rows = { ...(next.rows ?? { len: 100 }) } as Record<string, unknown>;

  for (const [rowKey, rowValue] of Object.entries(rows)) {
    if (canonicalSparseIndex(rowKey) === null || rowValue === null || typeof rowValue !== 'object'
      || Array.isArray(rowValue)) continue;
    const row = { ...rowValue } as Record<string, unknown>;
    if (row.cells === null || typeof row.cells !== 'object' || Array.isArray(row.cells)) continue;
    const cells = { ...row.cells } as Record<string, unknown>;
    for (const [cellKey, cellValue] of Object.entries(cells)) {
      if (canonicalSparseIndex(cellKey) === null || cellValue === null || typeof cellValue !== 'object'
        || Array.isArray(cellValue)) continue;
      const cell = { ...cellValue } as Record<string, unknown>;
      delete cell.merge;
      cells[cellKey] = cell as CellData;
    }
    row.cells = cells as CellsData;
    rows[rowKey] = row as RowData;
  }

  for (const merge of parsedMerges(next)) {
    const rowKey = String(merge.start.row);
    const cellKey = String(merge.start.column);
    const rowValue = rows[rowKey];
    const row = rowValue !== null && typeof rowValue === 'object' && !Array.isArray(rowValue)
      ? { ...rowValue } as Record<string, unknown>
      : {};
    const cellsValue = row.cells;
    const cells = cellsValue !== null && typeof cellsValue === 'object' && !Array.isArray(cellsValue)
      ? { ...cellsValue } as Record<string, unknown>
      : {};
    const cellValue = cells[cellKey];
    const cell = cellValue !== null && typeof cellValue === 'object' && !Array.isArray(cellValue)
      ? { ...cellValue } as Record<string, unknown>
      : {};
    cell.merge = [
      merge.end.row - merge.start.row,
      merge.end.column - merge.start.column,
    ];
    cells[cellKey] = cell as CellData;
    row.cells = cells as CellsData;
    rows[rowKey] = row as RowData;
  }
  return { ...next, rows: rows as RowsData } as unknown as SheetData;
}
