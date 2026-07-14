import { columnOffset, dataViewportRect, rowOffset } from './grid-geometry';
import type { CssRect, FreezeState, ViewportMetrics } from '../ports';

export type FrozenQuadrantKind = 'corner' | 'top' | 'left' | 'body';

export interface FrozenQuadrant extends CssRect {
  readonly kind: FrozenQuadrantKind;
}

function quadrant(kind: FrozenQuadrantKind, rect: CssRect): FrozenQuadrant | null {
  return rect.width > 0 && rect.height > 0 ? { kind, ...rect } : null;
}

export function frozenQuadrants(
  freeze: FreezeState,
  viewport: ViewportMetrics,
): readonly FrozenQuadrant[] {
  if (!Number.isSafeInteger(freeze.row) || freeze.row < 0
    || !Number.isSafeInteger(freeze.column) || freeze.column < 0) {
    throw new RangeError('freeze indexes must be non-negative safe integers');
  }
  const data = dataViewportRect(viewport);
  const frozenWidth = Math.min(
    data.width,
    columnOffset(Math.min(freeze.column, viewport.model.columnCount), viewport.model),
  );
  const frozenHeight = Math.min(
    data.height,
    rowOffset(Math.min(freeze.row, viewport.model.rowCount), viewport.model),
  );
  const remainingWidth = data.width - frozenWidth;
  const remainingHeight = data.height - frozenHeight;
  return [
    quadrant('corner', {
      left: data.left,
      top: data.top,
      width: frozenWidth,
      height: frozenHeight,
    }),
    quadrant('top', {
      left: data.left + frozenWidth,
      top: data.top,
      width: remainingWidth,
      height: frozenHeight,
    }),
    quadrant('left', {
      left: data.left,
      top: data.top + frozenHeight,
      width: frozenWidth,
      height: remainingHeight,
    }),
    quadrant('body', {
      left: data.left + frozenWidth,
      top: data.top + frozenHeight,
      width: remainingWidth,
      height: remainingHeight,
    }),
  ].filter((value): value is FrozenQuadrant => value !== null);
}
