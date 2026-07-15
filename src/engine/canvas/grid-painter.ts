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
  indexes: PaneGridIndexes = paneGridIndexes(pane, viewport),
): readonly CellPoint[] {
  const { rows, columns } = indexes;
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
    const rect = cellRect({ row, column: firstColumn }, viewport);
    return { start: rect.top, size: rect.height };
  });
  const columnBoundaries = boundaries(indexes.columns, column => {
    const rect = cellRect({ row: firstRow, column }, viewport);
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
