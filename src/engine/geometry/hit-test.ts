import type { CellPoint } from '../../core/types/coordinates';
import {
  findCellAtViewportPoint,
  findColumnAtViewportX,
  findRowAtViewportY,
} from './grid-geometry';
import type { CssPoint, ViewportMetrics } from '../ports';

export function hitTest(point: CssPoint, viewport: ViewportMetrics): CellPoint | null {
  const cell = findCellAtViewportPoint(point, viewport);
  if (cell === null) return null;
  return viewport.model.mergeAt(cell)?.start ?? cell;
}

export type HitTestRegion =
  | { readonly kind: 'corner' }
  | { readonly kind: 'row-header'; readonly row: number }
  | { readonly kind: 'column-header'; readonly column: number }
  | { readonly kind: 'cell'; readonly cell: CellPoint };

export function hitTestRegion(
  point: CssPoint,
  viewport: ViewportMetrics,
): HitTestRegion | null {
  if (point.x < 0 || point.x >= viewport.width || point.y < 0 || point.y >= viewport.height) {
    return null;
  }
  const inRowHeader = point.x < viewport.rowHeaderWidth;
  const inColumnHeader = point.y < viewport.columnHeaderHeight;
  if (inRowHeader && inColumnHeader) return { kind: 'corner' };
  if (inRowHeader) {
    const row = findRowAtViewportY(point.y, viewport);
    return row === null ? null : { kind: 'row-header', row };
  }
  if (inColumnHeader) {
    const column = findColumnAtViewportX(point.x, viewport);
    return column === null ? null : { kind: 'column-header', column };
  }
  const cell = hitTest(point, viewport);
  return cell === null ? null : { kind: 'cell', cell };
}
