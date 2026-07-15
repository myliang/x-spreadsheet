import { hitTestRegion } from '../geometry/hit-test';
import type { CssPoint, ViewportMetrics } from '../ports';
import type { SelectionState } from '../viewport/selection-state';

export type ResizeAxis = 'row' | 'column';

export interface ResizeHandle {
  readonly axis: ResizeAxis;
  readonly index: number;
  readonly boundary: number;
  readonly position: number;
  readonly size: number;
}

export interface ResizeBoundary {
  readonly axis: ResizeAxis;
  readonly boundary: number;
}

function previousVisible(
  axis: ResizeAxis,
  boundary: number,
  viewport: ViewportMetrics,
): number | null {
  return axis === 'row'
    ? viewport.model.previousVisibleRow(boundary)
    : viewport.model.previousVisibleColumn(boundary);
}

export function findResizeHandle(
  point: CssPoint,
  viewport: ViewportMetrics,
  tolerance = 5,
): ResizeHandle | null {
  const boundary = findResizeBoundary(point, viewport, tolerance);
  if (boundary === null) return null;
  const { model } = viewport;
  const size = boundary.axis === 'row' ? model.rowHeight : model.columnWidth;
  const index = previousVisible(boundary.axis, boundary.boundary, viewport);
  return index === null ? null : {
    ...boundary,
    index,
    position: boundary.axis === 'row' ? point.y : point.x,
    size: size(index),
  };
}

export function findResizeBoundary(
  point: CssPoint,
  viewport: ViewportMetrics,
  tolerance = 5,
): ResizeBoundary | null {
  const { model } = viewport;
  if (point.y < viewport.columnHeaderHeight && point.x >= viewport.rowHeaderWidth) {
    const region = hitTestRegion(point, viewport);
    if (region?.kind !== 'column-header') return null;
    const column = region.column;
    const left = viewport.rowHeaderWidth + model.columnOffset(column)
      - (column < viewport.freeze.column ? 0 : viewport.scroll.x);
    const leftDistance = Math.abs(point.x - left);
    const rightDistance = Math.abs(point.x - (left + model.columnWidth(column)));
    const hitsLeft = leftDistance <= tolerance && leftDistance <= rightDistance;
    if (!hitsLeft && rightDistance > tolerance) return null;
    return {
      axis: 'column',
      boundary: hitsLeft ? column : column + 1,
    };
  }
  if (point.x < viewport.rowHeaderWidth && point.y >= viewport.columnHeaderHeight) {
    const region = hitTestRegion(point, viewport);
    if (region?.kind !== 'row-header') return null;
    const row = region.row;
    const top = viewport.columnHeaderHeight + model.rowOffset(row)
      - (row < viewport.freeze.row ? 0 : viewport.scroll.y);
    const topDistance = Math.abs(point.y - top);
    const bottomDistance = Math.abs(point.y - (top + model.rowHeight(row)));
    const hitsTop = topDistance <= tolerance && topDistance <= bottomDistance;
    if (!hitsTop && bottomDistance > tolerance) return null;
    return {
      axis: 'row',
      boundary: hitsTop ? row : row + 1,
    };
  }
  return null;
}

export function resizeRange(
  handle: ResizeHandle,
  selection: SelectionState,
): readonly [start: number, count: number] {
  const start = handle.axis === 'row' ? selection.range.start.row : selection.range.start.column;
  const end = handle.axis === 'row' ? selection.range.end.row : selection.range.end.column;
  return handle.index >= start && handle.index <= end
    ? [start, end - start + 1]
    : [handle.index, 1];
}

export function hiddenRunBefore(
  axis: ResizeAxis,
  boundary: number,
  viewport: ViewportMetrics,
): readonly [start: number, count: number] | null {
  const previous = previousVisible(axis, boundary, viewport);
  const start = previous === null ? 0 : previous + 1;
  return start === boundary ? null : [start, boundary - start];
}
