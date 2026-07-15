import type { CellPoint, CellRange } from '../../core/types/coordinates';
import { rangesIntersect } from '../../core/coordinates/ranges';
import { cellRect } from '../geometry/grid-geometry';
import type { FrozenQuadrant } from '../geometry/frozen-pane-geometry';
import type { ViewportMetrics } from '../ports';
import type { DrawContext } from './draw-context';

const MAX_VISIBLE_CELLS = 250_000;

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
    return Array.from({ length: frozen }, (_, index) => index)
      .filter(index => axisSize(axis, index, viewport) > 0);
  }
  if (frozen >= count) return [];
  const scroll = axisScroll(axis, viewport);
  const contentStart = scroll + axisOffset(axis, frozen, viewport);
  const start = Math.max(frozen, axisAt(axis, contentStart, viewport) ?? frozen);
  const end = Math.min(
    count - 1,
    Math.max(start, axisAt(axis, contentStart + axisPaneExtent(axis, pane), viewport) ?? start),
  );
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
): readonly CellPoint[] {
  const rows = paneAxisIndexes('row', pane, viewport);
  const columns = paneAxisIndexes('column', pane, viewport);
  if (BigInt(rows.length) * BigInt(columns.length) > BigInt(MAX_VISIBLE_CELLS)) {
    throw new RangeError(`visible canvas pane exceeds the ${MAX_VISIBLE_CELLS}-cell limit`);
  }
  const points: CellPoint[] = [];
  const seen = new Set<string>();
  const add = (point: CellPoint): void => {
    const key = `${point.row}:${point.column}`;
    if (!seen.has(key)) {
      seen.add(key);
      points.push(point);
    }
  };
  for (const row of rows) {
    for (const column of columns) add({ row, column });
  }
  const range = coordinateRange(rows, columns);
  if (range !== null) {
    for (const merge of viewport.model.merges) {
      if (rangesIntersect(range, merge)) add(merge.start);
    }
  }
  return points;
}

export function paintGrid(
  draw: DrawContext,
  cells: readonly CellPoint[],
  viewport: ViewportMetrics,
): void {
  for (const point of cells) {
    const rect = cellRect(point, viewport);
    const right = rect.left + rect.width;
    const bottom = rect.top + rect.height;
    draw.line(
      { x: rect.left, y: rect.top },
      { x: right, y: rect.top },
      { color: '#e6e6e6' },
    );
    draw.line(
      { x: rect.left, y: rect.top },
      { x: rect.left, y: bottom },
      { color: '#e6e6e6' },
    );
    draw.line(
      { x: right, y: rect.top },
      { x: right, y: bottom },
      { color: '#e6e6e6' },
    );
    draw.line(
      { x: rect.left, y: bottom },
      { x: right, y: bottom },
      { color: '#e6e6e6' },
    );
  }
}
