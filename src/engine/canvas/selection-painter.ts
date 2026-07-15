import type { CellRange } from '../../core/types/coordinates';
import { rangeRect } from '../geometry/grid-geometry';
import type { ViewportMetrics } from '../ports';
import type { DrawContext } from './draw-context';

export function paintSelection(
  draw: DrawContext,
  selection: CellRange | undefined,
  viewport: ViewportMetrics,
): void {
  if (selection === undefined) return;
  const rect = rangeRect(selection, viewport);
  draw.fillRect(rect, 'rgba(75, 137, 255, 0.08)');
  draw.strokeRect(rect, '#4b89ff', 2);
}
