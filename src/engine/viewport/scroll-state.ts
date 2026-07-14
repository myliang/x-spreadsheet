import { columnOffset, rowOffset } from '../geometry/grid-geometry';
import type { ScrollState, ViewportMetrics } from '../ports';

export function createScrollState(x = 0, y = 0): ScrollState {
  if (!Number.isFinite(x) || x < 0 || !Number.isFinite(y) || y < 0) {
    throw new RangeError('scroll offsets must be non-negative finite numbers');
  }
  return Object.freeze({ x, y });
}

export function clampScroll(
  scroll: Readonly<ScrollState>,
  viewport: ViewportMetrics,
): ScrollState {
  const contentWidth = columnOffset(viewport.model.columnCount, viewport.model);
  const contentHeight = rowOffset(viewport.model.rowCount, viewport.model);
  const availableWidth = Math.max(0, viewport.width - viewport.rowHeaderWidth);
  const availableHeight = Math.max(0, viewport.height - viewport.columnHeaderHeight);
  return createScrollState(
    Math.min(Math.max(0, scroll.x), Math.max(0, contentWidth - availableWidth)),
    Math.min(Math.max(0, scroll.y), Math.max(0, contentHeight - availableHeight)),
  );
}

export function scrollBy(
  scroll: Readonly<ScrollState>,
  delta: Readonly<{ x: number; y: number }>,
  viewport: ViewportMetrics,
): ScrollState {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
    throw new RangeError('scroll delta must contain finite numbers');
  }
  return clampScroll({ x: scroll.x + delta.x, y: scroll.y + delta.y }, viewport);
}

export function scrollTo(
  scroll: Readonly<ScrollState>,
  viewport: ViewportMetrics,
): ScrollState {
  const snapAxis = (
    target: number,
    frozen: number,
    totalExtent: number,
    offset: (boundary: number) => number,
    indexAt: (coordinate: number) => number | null,
  ): number => {
    if (!Number.isFinite(target) || target < 0) {
      throw new RangeError('scroll offsets must be non-negative finite numbers');
    }
    if (target === 0) return 0;
    const start = offset(frozen);
    const boundedTarget = Math.min(target, Math.max(0, totalExtent - start));
    const index = indexAt(start + boundedTarget);
    return index === null ? 0 : Math.max(0, offset(index + 1) - start);
  };
  return clampScroll({
    x: snapAxis(
      scroll.x,
      viewport.freeze.column,
      viewport.model.columnOffset(viewport.model.columnCount),
      viewport.model.columnOffset,
      viewport.model.columnAt,
    ),
    y: snapAxis(
      scroll.y,
      viewport.freeze.row,
      viewport.model.rowOffset(viewport.model.rowCount),
      viewport.model.rowOffset,
      viewport.model.rowAt,
    ),
  }, viewport);
}
