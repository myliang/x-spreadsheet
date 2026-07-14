import { containsCell, parseA1Range } from '../core/coordinates/ranges';
import type { CellPoint, CellRange } from '../core/types/coordinates';
import type { ColumnData, RowData, SheetData } from '../core/types/workbook';

export interface CssPoint {
  readonly x: number;
  readonly y: number;
}

export interface CssRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ScrollState {
  readonly x: number;
  readonly y: number;
}

export type FreezeState = CellPoint;

export interface GridModelPort {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly merges: readonly CellRange[];
  readonly rowHeight: (row: number) => number;
  readonly columnWidth: (column: number) => number;
  readonly rowOffset: (rowBoundary: number) => number;
  readonly columnOffset: (columnBoundary: number) => number;
  readonly rowAt: (contentY: number) => number | null;
  readonly columnAt: (contentX: number) => number | null;
  readonly mergeAt: (point: CellPoint) => CellRange | null;
}

export interface ViewportMetrics {
  readonly model: GridModelPort;
  readonly width: number;
  readonly height: number;
  readonly rowHeaderWidth: number;
  readonly columnHeaderHeight: number;
  readonly scroll: ScrollState;
  readonly freeze: FreezeState;
}

export interface SheetGridSizing {
  readonly defaultRowHeight?: number;
  readonly defaultColumnWidth?: number;
}

const DEFAULT_ROW_COUNT = 100;
const DEFAULT_COLUMN_COUNT = 26;
const DEFAULT_ROW_HEIGHT = 25;
const DEFAULT_COLUMN_WIDTH = 100;

function collectionLength(value: number | undefined, fallback: number, label: string): number {
  const length = value ?? fallback;
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError(`${label} count must be a non-negative safe integer`);
  }
  return length;
}

function defaultSize(value: number | undefined, fallback: number, label: string): number {
  const size = value ?? fallback;
  if (!Number.isFinite(size) || size < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
  return size;
}

function overrideSize(value: number | undefined, fallback: number, label: string): number {
  return defaultSize(value === 0 ? undefined : value, fallback, label);
}

function indexedObject<T>(value: unknown): T | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as T
    : null;
}

function assertIndex(index: number, count: number, label: string): void {
  if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`${label} is outside the grid`);
  }
}

interface SparseAxis {
  readonly size: (index: number) => number;
  readonly offset: (boundary: number) => number;
  readonly indexAt: (coordinate: number) => number | null;
}

interface AxisOverride {
  readonly index: number;
  readonly size: number;
  readonly prefixDelta: number;
}

type ZeroExtentPolicy = 'last' | 'none';

function sparseIndex(key: string, count: number): number | null {
  if (!/^(0|[1-9]\d*)$/.test(key)) return null;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < count ? index : null;
}

function upperBound(overrides: readonly AxisOverride[], boundary: number): number {
  let low = 0;
  let high = overrides.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if ((overrides[middle]?.index ?? 0) < boundary) low = middle + 1;
    else high = middle;
  }
  return low;
}

function createSparseAxis<T extends { readonly hide?: boolean }>(
  collection: Readonly<Record<string, unknown>> | undefined,
  count: number,
  fallback: number,
  sizeOf: (data: T) => number | undefined,
  label: 'row' | 'column',
  zeroExtentPolicy: ZeroExtentPolicy,
): SparseAxis {
  const rawOverrides = Object.entries(collection ?? {}).flatMap(([key, value]) => {
    const index = sparseIndex(key, count);
    const data = indexedObject<T>(value);
    if (index === null || data === null) return [];
    const size = data.hide === true
      ? 0
      : overrideSize(sizeOf(data), fallback, `${label} size`);
    return size === fallback ? [] : [{ index, size }];
  }).sort((left, right) => left.index - right.index);
  let delta = 0;
  const overrides = rawOverrides.map(value => {
    delta += value.size - fallback;
    return { ...value, prefixDelta: delta };
  });
  if (!Number.isFinite(count * fallback + delta)) {
    throw new RangeError(`${label} geometry must have a finite extent`);
  }

  const offset = (boundary: number): number => {
    if (!Number.isSafeInteger(boundary) || boundary < 0 || boundary > count) {
      throw new RangeError(`${label} boundary is outside the grid`);
    }
    const position = upperBound(overrides, boundary);
    const prefixDelta = position === 0 ? 0 : overrides[position - 1]?.prefixDelta ?? 0;
    return boundary * fallback + prefixDelta;
  };
  const size = (index: number): number => {
    assertIndex(index, count, label);
    const position = upperBound(overrides, index);
    const candidate = overrides[position];
    return candidate?.index === index ? candidate.size : fallback;
  };
  const indexAt = (coordinate: number): number | null => {
    if (!Number.isFinite(coordinate) || coordinate < 0 || count === 0) return null;
    const total = offset(count);
    if (total === 0) return zeroExtentPolicy === 'last' ? count - 1 : null;
    if (coordinate >= total) return count - 1;
    let low = 0;
    let high = count;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (offset(middle) <= coordinate) low = middle + 1;
      else high = middle;
    }
    const index = Math.min(count - 1, low - 1);
    return size(index) > 0 && coordinate < offset(index + 1) ? index : null;
  };
  return { size, offset, indexAt };
}

export function createSheetGridModel(
  sheet: Readonly<SheetData>,
  sizing: Readonly<SheetGridSizing> = {},
): GridModelPort {
  const rowCount = collectionLength(sheet.rows?.len, DEFAULT_ROW_COUNT, 'row');
  const columnCount = collectionLength(sheet.cols?.len, DEFAULT_COLUMN_COUNT, 'column');
  const defaultRowHeight = defaultSize(
    sizing.defaultRowHeight,
    DEFAULT_ROW_HEIGHT,
    'default row height',
  );
  const defaultColumnWidth = defaultSize(
    sizing.defaultColumnWidth,
    DEFAULT_COLUMN_WIDTH,
    'default column width',
  );
  const merges = Object.freeze((sheet.merges ?? []).map(parseA1Range));
  const rows = createSparseAxis<RowData>(
    sheet.rows,
    rowCount,
    defaultRowHeight,
    data => data.height,
    'row',
    defaultRowHeight > 0 ? 'last' : 'none',
  );
  const columns = createSparseAxis<ColumnData>(
    sheet.cols,
    columnCount,
    defaultColumnWidth,
    data => data.width,
    'column',
    'last',
  );

  return Object.freeze({
    rowCount,
    columnCount,
    merges,
    rowHeight: rows.size,
    columnWidth: columns.size,
    rowOffset: rows.offset,
    columnOffset: columns.offset,
    rowAt: rows.indexAt,
    columnAt: columns.indexAt,
    mergeAt: (point: CellPoint): CellRange | null => (
      merges.find(merge => containsCell(merge, point)) ?? null
    ),
  });
}
