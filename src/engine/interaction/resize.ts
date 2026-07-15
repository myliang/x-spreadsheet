import { hitTestRegion } from '../geometry/hit-test';
import type { CssPoint, ViewportMetrics } from '../ports';
import type { SelectionState } from '../viewport/selection-state';

export type ResizeAxis = 'row' | 'column';

export interface ResizeHandle {
  readonly axis: ResizeAxis;
  readonly index: number;
  readonly position: number;
  readonly size: number;
}

function previousVisible(index: number, size: (value: number) => number): number | null {
  for (let current = index; current >= 0; current -= 1) {
    if (size(current) > 0) return current;
  }
  return null;
}

export function findResizeHandle(
  point: CssPoint,
  viewport: ViewportMetrics,
  tolerance = 5,
): ResizeHandle | null {
  const { model } = viewport;
  if (point.y < viewport.columnHeaderHeight && point.x >= viewport.rowHeaderWidth) {
    const region = hitTestRegion(point, viewport);
    if (region?.kind !== 'column-header') return null;
    const column = region.column;
    const left = viewport.rowHeaderWidth + model.columnOffset(column)
      - (column < viewport.freeze.column ? 0 : viewport.scroll.x);
    const leftDistance = Math.abs(point.x - left);
    const rightDistance = Math.abs(point.x - (left + model.columnWidth(column)));
    const index = leftDistance <= tolerance && leftDistance <= rightDistance
      ? previousVisible(column - 1, model.columnWidth)
      : rightDistance <= tolerance ? previousVisible(column, model.columnWidth) : null;
    return index === null ? null : {
      axis: 'column',
      index,
      position: point.x,
      size: model.columnWidth(index),
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
    const index = topDistance <= tolerance && topDistance <= bottomDistance
      ? previousVisible(row - 1, model.rowHeight)
      : bottomDistance <= tolerance ? previousVisible(row, model.rowHeight) : null;
    return index === null ? null : {
      axis: 'row',
      index,
      position: point.y,
      size: model.rowHeight(index),
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
  const size = axis === 'row' ? viewport.model.rowHeight : viewport.model.columnWidth;
  let start = boundary;
  while (start > 0 && size(start - 1) === 0) start -= 1;
  return start === boundary ? null : [start, boundary - start];
}
