import { normalizeCellRange } from '../../core/types/coordinates';
import type { CellPoint, CellRange } from '../../core/types/coordinates';
import type { CssRect, GridModelPort, ViewportMetrics } from '../ports';

type Axis = 'row' | 'column';

function axisSize(axis: Axis, index: number, model: GridModelPort): number {
  return axis === 'row' ? model.rowHeight(index) : model.columnWidth(index);
}

function axisOffset(index: number, axis: Axis, model: GridModelPort): number {
  return axis === 'row' ? model.rowOffset(index) : model.columnOffset(index);
}

export function rowOffset(row: number, model: GridModelPort): number {
  return axisOffset(row, 'row', model);
}

export function columnOffset(column: number, model: GridModelPort): number {
  return axisOffset(column, 'column', model);
}

function viewportAxisPosition(index: number, axis: Axis, viewport: ViewportMetrics): number {
  const header = axis === 'row' ? viewport.columnHeaderHeight : viewport.rowHeaderWidth;
  const scroll = axis === 'row' ? viewport.scroll.y : viewport.scroll.x;
  const frozen = axis === 'row' ? viewport.freeze.row : viewport.freeze.column;
  const content = axisOffset(index, axis, viewport.model);
  return header + content - (index < frozen ? 0 : scroll);
}

function axisRangeBounds(
  start: number,
  end: number,
  axis: Axis,
  viewport: ViewportMetrics,
): readonly [start: number, end: number] {
  const frozen = axis === 'row' ? viewport.freeze.row : viewport.freeze.column;
  const segments: Array<readonly [number, number]> = [];
  if (start < frozen) segments.push([start, Math.min(end, frozen - 1)]);
  if (end >= frozen) segments.push([Math.max(start, frozen), end]);
  const bounds = segments.map(([segmentStart, segmentEnd]) => {
    const position = viewportAxisPosition(segmentStart, axis, viewport);
    return [
      position,
      viewportAxisPosition(segmentEnd, axis, viewport)
        + axisSize(axis, segmentEnd, viewport.model),
    ] as const;
  });
  return [
    Math.min(...bounds.flatMap(value => value)),
    Math.max(...bounds.flatMap(value => value)),
  ];
}

function rangeRectRaw(range: CellRange, viewport: ViewportMetrics): CssRect {
  const normalized = normalizeCellRange(range);
  const [left, right] = axisRangeBounds(
    normalized.start.column,
    normalized.end.column,
    'column',
    viewport,
  );
  const [top, bottom] = axisRangeBounds(
    normalized.start.row,
    normalized.end.row,
    'row',
    viewport,
  );
  return { left, top, width: right - left, height: bottom - top };
}

export function resolveMergedRange(point: CellPoint, model: GridModelPort): CellRange {
  return model.mergeAt(point) ?? { start: point, end: point };
}

export function cellRect(point: CellPoint, viewport: ViewportMetrics): CssRect {
  return rangeRectRaw(resolveMergedRange(point, viewport.model), viewport);
}

export function rangeRect(range: CellRange, viewport: ViewportMetrics): CssRect {
  return rangeRectRaw(range, viewport);
}

export function dataViewportRect(viewport: ViewportMetrics): CssRect {
  return {
    left: viewport.rowHeaderWidth,
    top: viewport.columnHeaderHeight,
    width: Math.max(0, viewport.width - viewport.rowHeaderWidth),
    height: Math.max(0, viewport.height - viewport.columnHeaderHeight),
  };
}

function intersectRect(first: CssRect, second: CssRect): CssRect | null {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.left + first.width, second.left + second.width);
  const bottom = Math.min(first.top + first.height, second.top + second.height);
  return right > left && bottom > top
    ? { left, top, width: right - left, height: bottom - top }
    : null;
}

export function clipToDataViewport(
  rect: CssRect,
  viewport: ViewportMetrics,
): CssRect | null {
  return intersectRect(rect, dataViewportRect(viewport));
}

export function visibleCellRange(viewport: ViewportMetrics): CellRange | null {
  if (viewport.model.rowCount === 0 || viewport.model.columnCount === 0) return null;
  const { left, top, width, height } = dataViewportRect(viewport);
  if (width === 0 || height === 0) return null;
  const insideEdge = 1e-7;
  const topLeft = findCellAtViewportPoint(
    { x: left + insideEdge, y: top + insideEdge },
    viewport,
  );
  const bottomRight = findCellAtViewportPoint(
    { x: left + width - insideEdge, y: top + height - insideEdge },
    viewport,
  );
  if (topLeft === null || bottomRight === null) return null;
  return normalizeCellRange({ start: topLeft, end: bottomRight });
}

function findAxisIndex(coordinate: number, axis: Axis, model: GridModelPort): number | null {
  return axis === 'row' ? model.rowAt(coordinate) : model.columnAt(coordinate);
}

function viewportAxisIndex(
  coordinate: number,
  axis: Axis,
  viewport: ViewportMetrics,
): number | null {
  const header = axis === 'row' ? viewport.columnHeaderHeight : viewport.rowHeaderWidth;
  const extent = axis === 'row' ? viewport.height : viewport.width;
  if (coordinate < header || coordinate >= extent) return null;
  const local = coordinate - header;
  const frozen = axis === 'row' ? viewport.freeze.row : viewport.freeze.column;
  const frozenSize = axisOffset(frozen, axis, viewport.model);
  const scroll = axis === 'row' ? viewport.scroll.y : viewport.scroll.x;
  return findAxisIndex(local <= frozenSize ? local : local + scroll, axis, viewport.model);
}

export function findRowAtViewportY(y: number, viewport: ViewportMetrics): number | null {
  return viewportAxisIndex(y, 'row', viewport);
}

export function findColumnAtViewportX(x: number, viewport: ViewportMetrics): number | null {
  return viewportAxisIndex(x, 'column', viewport);
}

export function findCellAtViewportPoint(
  point: Readonly<{ x: number; y: number }>,
  viewport: ViewportMetrics,
): CellPoint | null {
  if (point.x < viewport.rowHeaderWidth || point.x >= viewport.width
    || point.y < viewport.columnHeaderHeight || point.y >= viewport.height) return null;
  const column = findColumnAtViewportX(point.x, viewport);
  const row = findRowAtViewportY(point.y, viewport);
  return row === null || column === null ? null : { row, column };
}
