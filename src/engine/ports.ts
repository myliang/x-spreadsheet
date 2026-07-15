import { containsCell, parseA1Range } from '../core/coordinates/ranges';
import { filteredRows } from '../core/operations/filter';
import { sortRows } from '../core/operations/sort';
import type { LocaleDefinition } from '../core/types/changes';
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
  readonly previousVisibleRow: (rowBoundary: number) => number | null;
  readonly previousVisibleColumn: (columnBoundary: number) => number | null;
  readonly mergeAt: (point: CellPoint) => CellRange | null;
  readonly logicalRowAtVisualIndex: (visualRow: number) => number;
  readonly visualIndexOfRow: (logicalRow: number) => number;
  readonly visualRowRange: (logicalStart: number, logicalEnd: number) => readonly [number, number];
  readonly logicalRowRange: (visualStart: number, visualEnd: number) => readonly [number, number];
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
  readonly locale?: LocaleDefinition;
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

function frozenRange(range: CellRange): CellRange {
  return Object.freeze({
    start: Object.freeze({ row: range.start.row, column: range.start.column }),
    end: Object.freeze({ row: range.end.row, column: range.end.column }),
  });
}

interface RowOrder {
  readonly logicalAtVisual: (visualRow: number) => number;
  readonly visualOfLogical: (logicalRow: number) => number;
  readonly visualRange: (logicalStart: number, logicalEnd: number) => readonly [number, number];
  readonly logicalRange: (visualStart: number, visualEnd: number) => readonly [number, number];
  readonly reordered: boolean;
}

function identityRowOrder(count: number): RowOrder {
  const assertRow = (row: number, label: string): number => {
    assertIndex(row, count, label);
    return row;
  };
  return {
    logicalAtVisual: row => assertRow(row, 'visual row'),
    visualOfLogical: row => assertRow(row, 'logical row'),
    visualRange(logicalStart, logicalEnd) {
      assertRow(logicalStart, 'logical row range start');
      assertRow(logicalEnd, 'logical row range end');
      return [logicalStart, logicalEnd];
    },
    logicalRange(visualStart, visualEnd) {
      assertRow(visualStart, 'visual row range start');
      assertRow(visualEnd, 'visual row range end');
      return [visualStart, visualEnd];
    },
    reordered: false,
  };
}

function mappedRangeBounds(
  inputStart: number,
  inputEnd: number,
  count: number,
  mappedStart: number,
  mappedEnd: number,
  map: (index: number) => number,
  label: string,
): readonly [number, number] {
  assertIndex(inputStart, count, `${label} range start`);
  assertIndex(inputEnd, count, `${label} range end`);
  if (inputStart > inputEnd) throw new RangeError(`${label} range must be normalized`);
  if (inputStart === inputEnd) {
    const mapped = map(inputStart);
    return [mapped, mapped];
  }
  let first = count;
  let last = -1;
  const include = (index: number): void => {
    first = Math.min(first, index);
    last = Math.max(last, index);
  };
  if (inputStart < mappedStart) {
    include(inputStart);
    include(Math.min(inputEnd, mappedStart - 1));
  }
  const overlapStart = Math.max(inputStart, mappedStart);
  const overlapEnd = Math.min(inputEnd, mappedEnd);
  for (let index = overlapStart; index <= overlapEnd; index += 1) include(map(index));
  if (inputEnd > mappedEnd) {
    include(Math.max(inputStart, mappedEnd + 1));
    include(inputEnd);
  }
  return [first, last];
}

function createRowOrder(
  sheet: Readonly<SheetData>,
  count: number,
  locale: LocaleDefinition,
): RowOrder {
  const sort = sheet.autofilter?.sort;
  const reference = sheet.autofilter?.ref;
  if (sort?.ci === undefined || sort.order === undefined || reference === undefined) {
    return identityRowOrder(count);
  }
  try {
    const parsed = parseA1Range(reference);
    const start = Math.min(count, parsed.start.row + 1);
    const end = Math.min(count - 1, parsed.end.row);
    if (start > end) return identityRowOrder(count);
    const range = {
      start: { row: parsed.start.row, column: parsed.start.column },
      end: { row: end, column: parsed.end.column },
    };
    const sorted = sortRows(sheet, sort.ci, sort.order, locale, range);
    const included = new Set(sorted);
    const order = [
      ...sorted,
      ...Array.from({ length: end - start + 1 }, (_, index) => start + index)
        .filter(row => !included.has(row)),
    ];
    const visualByLogical = new Map(order.map((row, index) => [row, start + index]));
    return {
      logicalAtVisual(visualRow) {
        assertIndex(visualRow, count, 'visual row');
        return visualRow < start || visualRow > end
          ? visualRow
          : order[visualRow - start] as number;
      },
      visualOfLogical(logicalRow) {
        assertIndex(logicalRow, count, 'logical row');
        return visualByLogical.get(logicalRow) ?? logicalRow;
      },
      visualRange(logicalStart, logicalEnd) {
        return mappedRangeBounds(
          logicalStart,
          logicalEnd,
          count,
          start,
          end,
          logicalRow => visualByLogical.get(logicalRow) ?? logicalRow,
          'logical row',
        );
      },
      logicalRange(visualStart, visualEnd) {
        return mappedRangeBounds(
          visualStart,
          visualEnd,
          count,
          start,
          end,
          visualRow => order[visualRow - start] ?? visualRow,
          'visual row',
        );
      },
      reordered: order.some((row, index) => row !== start + index),
    };
  } catch {
    return identityRowOrder(count);
  }
}

function remapRows(
  rows: Readonly<Record<string, unknown>> | undefined,
  count: number,
  order: RowOrder,
): Readonly<Record<string, unknown>> | undefined {
  if (!order.reordered || rows === undefined) return rows;
  return Object.fromEntries(Object.entries(rows).map(([key, value]) => {
    const logical = sparseIndex(key, count);
    return logical === null ? [key, value] : [String(order.visualOfLogical(logical)), value];
  }));
}

interface SparseAxis {
  readonly size: (index: number) => number;
  readonly offset: (boundary: number) => number;
  readonly indexAt: (coordinate: number) => number | null;
  readonly previousVisible: (boundary: number) => number | null;
}

interface AxisOverride {
  readonly index: number;
  readonly size: number;
  readonly prefixSizeSum: number;
  readonly previousVisible: number | null;
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
  forcedHidden: readonly number[] = [],
): SparseAxis {
  const overrideSizes = new Map<number, number>();
  for (const [key, value] of Object.entries(collection ?? {})) {
    const index = sparseIndex(key, count);
    const data = indexedObject<T>(value);
    if (index === null || data === null) continue;
    const size = data.hide === true
      ? 0
      : overrideSize(sizeOf(data), fallback, `${label} size`);
    if (size !== fallback) overrideSizes.set(index, size);
  }
  for (const index of forcedHidden) {
    if (Number.isSafeInteger(index) && index >= 0 && index < count) overrideSizes.set(index, 0);
  }
  const rawOverrides = [...overrideSizes.entries()]
    .map(([index, size]) => ({ index, size }))
    .sort((left, right) => left.index - right.index);
  let overrideSizeSum = 0;
  let previousOverrideIndex = -1;
  let lastVisible: number | null = null;
  const overrides = rawOverrides.map(value => {
    if (fallback > 0 && value.index > previousOverrideIndex + 1) {
      lastVisible = value.index - 1;
    }
    const previousVisible = lastVisible;
    if (value.size > 0) lastVisible = value.index;
    previousOverrideIndex = value.index;
    overrideSizeSum += value.size;
    return { ...value, prefixSizeSum: overrideSizeSum, previousVisible };
  });
  const extent = (count - overrides.length) * fallback + overrideSizeSum;
  if (!Number.isFinite(extent)) {
    throw new RangeError(`${label} geometry must have a finite extent`);
  }

  const offset = (boundary: number): number => {
    if (!Number.isSafeInteger(boundary) || boundary < 0 || boundary > count) {
      throw new RangeError(`${label} boundary is outside the grid`);
    }
    const position = upperBound(overrides, boundary);
    const prefixSizeSum = position === 0
      ? 0
      : overrides[position - 1]?.prefixSizeSum ?? 0;
    return (boundary - position) * fallback + prefixSizeSum;
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
  const previousVisible = (boundary: number): number | null => {
    if (!Number.isSafeInteger(boundary) || boundary < 0 || boundary > count) {
      throw new RangeError(`${label} boundary is outside the grid`);
    }
    if (boundary === 0) return null;
    const candidate = boundary - 1;
    const position = upperBound(overrides, boundary);
    const override = position === 0 ? undefined : overrides[position - 1];
    if (override?.index === candidate) {
      return override.size > 0 ? candidate : override.previousVisible;
    }
    if (fallback > 0) return candidate;
    return override?.size === 0 ? override.previousVisible : override?.index ?? null;
  };
  return { size, offset, indexAt, previousVisible };
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
  const merges = Object.freeze((sheet.merges ?? []).map(value => (
    frozenRange(parseA1Range(value))
  )));
  const order = createRowOrder(sheet, rowCount, sizing.locale ?? { id: 'en', messages: {} });
  let filtered: readonly number[] = [];
  try {
    filtered = filteredRows(sheet);
  } catch {
    // Invalid imported filter metadata stays inert until a valid command replaces it.
  }
  const rows = createSparseAxis<RowData>(
    remapRows(sheet.rows, rowCount, order),
    rowCount,
    defaultRowHeight,
    data => data.height,
    'row',
    defaultRowHeight > 0 ? 'last' : 'none',
    filtered.map(order.visualOfLogical),
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
    rowHeight: (logicalRow: number) => rows.size(order.visualOfLogical(logicalRow)),
    columnWidth: columns.size,
    rowOffset: rows.offset,
    columnOffset: columns.offset,
    rowAt: rows.indexAt,
    columnAt: columns.indexAt,
    previousVisibleRow: (boundary: number) => {
      const visual = rows.previousVisible(boundary);
      return visual === null ? null : order.logicalAtVisual(visual);
    },
    previousVisibleColumn: columns.previousVisible,
    mergeAt: (point: CellPoint): CellRange | null => (
      merges.find(merge => containsCell(merge, point)) ?? null
    ),
    logicalRowAtVisualIndex: order.logicalAtVisual,
    visualIndexOfRow: order.visualOfLogical,
    visualRowRange: order.visualRange,
    logicalRowRange: order.logicalRange,
  });
}
