import type { CellPoint, CellRange } from '../../core/types/coordinates';
import type { SheetData } from '../../core/types/workbook';
import { rangesIntersect } from '../../core/coordinates/ranges';
import { rangeRect } from '../geometry/grid-geometry';
import type { FrozenQuadrant } from '../geometry/frozen-pane-geometry';
import type { ViewportMetrics } from '../ports';
import type { DrawContext } from './draw-context';

const MAX_VISIBLE_CELLS = 250_000;
const MAX_VISIBLE_AXIS_INDEXES = 250_000;

type Axis = 'row' | 'column';

function axisCount(axis: Axis, viewport: ViewportMetrics): number {
  return axis === 'row' ? viewport.model.rowCount : viewport.model.columnCount;
}

function axisFreeze(axis: Axis, viewport: ViewportMetrics): number {
  return axis === 'row' ? viewport.freeze.row : viewport.freeze.column;
}

function axisScroll(axis: Axis, viewport: ViewportMetrics): number {
  return axis === 'row' ? viewport.scroll.y : viewport.scroll.x;
}

function axisPaneExtent(axis: Axis, pane: FrozenQuadrant): number {
  return axis === 'row' ? pane.height : pane.width;
}

function axisAt(axis: Axis, coordinate: number, viewport: ViewportMetrics): number | null {
  return axis === 'row'
    ? viewport.model.rowAt(coordinate)
    : viewport.model.columnAt(coordinate);
}

function axisSize(axis: Axis, index: number, viewport: ViewportMetrics): number {
  return axis === 'row'
    ? viewport.model.rowHeight(index)
    : viewport.model.columnWidth(index);
}

function axisOffset(axis: Axis, boundary: number, viewport: ViewportMetrics): number {
  return axis === 'row'
    ? viewport.model.rowOffset(boundary)
    : viewport.model.columnOffset(boundary);
}

function isFrozenAxis(axis: Axis, pane: FrozenQuadrant): boolean {
  return axis === 'row'
    ? pane.kind === 'corner' || pane.kind === 'top'
    : pane.kind === 'corner' || pane.kind === 'left';
}

function paneAxisIndexes(
  axis: Axis,
  pane: FrozenQuadrant,
  viewport: ViewportMetrics,
): readonly number[] {
  const count = axisCount(axis, viewport);
  const frozen = Math.min(axisFreeze(axis, viewport), count);
  if (isFrozenAxis(axis, pane)) {
    if (frozen === 0) return [];
    const extentEnd = axisAt(axis, axisPaneExtent(axis, pane), viewport) ?? 0;
    return enumerateAxisIndexes(axis, 0, Math.min(frozen - 1, extentEnd), viewport);
  }
  if (frozen >= count) return [];
  const scroll = axisScroll(axis, viewport);
  const contentStart = scroll + axisOffset(axis, frozen, viewport);
  const start = Math.max(frozen, axisAt(axis, contentStart, viewport) ?? frozen);
  const end = Math.min(
    count - 1,
    Math.max(start, axisAt(axis, contentStart + axisPaneExtent(axis, pane), viewport) ?? start),
  );
  return enumerateAxisIndexes(axis, start, end, viewport);
}

function enumerateAxisIndexes(
  axis: Axis,
  start: number,
  end: number,
  viewport: ViewportMetrics,
): readonly number[] {
  const length = BigInt(end) - BigInt(start) + 1n;
  if (length > BigInt(MAX_VISIBLE_AXIS_INDEXES)) {
    throw new RangeError(
      `visible canvas ${axis} axis exceeds the ${MAX_VISIBLE_AXIS_INDEXES}-index limit`,
    );
  }
  const indexes: number[] = [];
  for (let index = start; index <= end; index += 1) {
    if (axisSize(axis, index, viewport) > 0) indexes.push(index);
  }
  return indexes;
}

function coordinateRange(rows: readonly number[], columns: readonly number[]): CellRange | null {
  const firstRow = rows[0];
  const lastRow = rows.at(-1);
  const firstColumn = columns[0];
  const lastColumn = columns.at(-1);
  return firstRow === undefined || lastRow === undefined
    || firstColumn === undefined || lastColumn === undefined
    ? null
    : {
        start: { row: firstRow, column: firstColumn },
        end: { row: lastRow, column: lastColumn },
      };
}

export function paneCells(
  pane: FrozenQuadrant,
  viewport: ViewportMetrics,
  indexes: PaneGridIndexes,
  sheet: Readonly<SheetData>,
): readonly CellPoint[] {
  const { rows, columns } = indexes;
  const points: CellPoint[] = [];
  const seen = new Set<string>();
  const add = (point: CellPoint): void => {
    const key = `${point.row}:${point.column}`;
    if (!seen.has(key)) {
      if (points.length >= MAX_VISIBLE_CELLS) {
        throw new RangeError(`visible canvas pane exceeds the ${MAX_VISIBLE_CELLS}-cell limit`);
      }
      seen.add(key);
      points.push(point);
    }
  };
  const visibleColumns = new Set(columns);
  const sparseRows = indexedObject(sheet.rows);
  for (const row of rows) {
    const rowData = indexedObject(sparseRows?.[row]);
    if (rowData === null) continue;
    const cells = indexedObject(rowData.cells);
    if (cells === null) continue;
    for (const [columnKey, cellValue] of Object.entries(cells)) {
      const column = sparseIndex(columnKey, viewport.model.columnCount);
      if (column !== null && visibleColumns.has(column) && indexedObject(cellValue) !== null) {
        add({ row, column });
      }
    }
  }
  const range = coordinateRange(rows, columns);
  if (range !== null) {
    for (const merge of viewport.model.merges) {
      if (rangesIntersect(range, merge)) add(merge.start);
    }
  }
  return points;
}

function indexedObject(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : null;
}

function sparseIndex(key: string, count: number): number | null {
  if (!/^(0|[1-9]\d*)$/.test(key)) return null;
  const index = Number(key);
  return Number.isSafeInteger(index) && index < count ? index : null;
}

export interface PaneGridIndexes {
  readonly rows: readonly number[];
  readonly columns: readonly number[];
}

export function paneGridIndexes(
  pane: FrozenQuadrant,
  viewport: ViewportMetrics,
): PaneGridIndexes {
  return {
    rows: paneAxisIndexes('row', pane, viewport),
    columns: paneAxisIndexes('column', pane, viewport),
  };
}

function boundaries(
  indexes: readonly number[],
  rectAt: (index: number) => Readonly<{ start: number; size: number }>,
): readonly number[] {
  const values = new Set<number>();
  for (const index of indexes) {
    const rect = rectAt(index);
    values.add(rect.start);
    values.add(rect.start + rect.size);
  }
  return [...values].sort((first, second) => first - second);
}

export function paintGrid(
  draw: DrawContext,
  indexes: PaneGridIndexes,
  viewport: ViewportMetrics,
): void {
  const firstRow = indexes.rows[0];
  const firstColumn = indexes.columns[0];
  if (firstRow === undefined || firstColumn === undefined) return;
  const rowBoundaries = boundaries(indexes.rows, row => {
    const point = { row, column: firstColumn };
    const rect = rangeRect({ start: point, end: point }, viewport);
    return { start: rect.top, size: rect.height };
  });
  const columnBoundaries = boundaries(indexes.columns, column => {
    const point = { row: firstRow, column };
    const rect = rangeRect({ start: point, end: point }, viewport);
    return { start: rect.left, size: rect.width };
  });
  const left = columnBoundaries[0];
  const right = columnBoundaries.at(-1);
  const top = rowBoundaries[0];
  const bottom = rowBoundaries.at(-1);
  if (left === undefined || right === undefined || top === undefined || bottom === undefined) return;
  for (const y of rowBoundaries) {
    draw.line(
      { x: left, y },
      { x: right, y },
      { color: '#e6e6e6' },
    );
  }
  for (const x of columnBoundaries) {
    draw.line(
      { x, y: top },
      { x, y: bottom },
      { color: '#e6e6e6' },
    );
  }
}
