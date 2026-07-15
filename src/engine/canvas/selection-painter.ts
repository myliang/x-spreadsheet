import type { CellRange } from '../../core/types/coordinates';
import type { FrozenQuadrantKind } from '../geometry/frozen-pane-geometry';
import { overlayAnchors } from '../geometry/overlay-anchors';
import type { ViewportMetrics } from '../ports';
import type { DrawContext } from './draw-context';

export function paintSelection(
  draw: DrawContext,
  selection: CellRange | undefined,
  viewport: ViewportMetrics,
  pane: FrozenQuadrantKind,
): void {
  if (selection === undefined) return;
  for (const rect of overlayAnchors(selection, viewport)) {
    if (rect.pane !== pane) continue;
    draw.fillRect(rect, 'rgba(75, 137, 255, 0.1)');
    draw.strokeRect(rect, '#4b89ff', 2);
  }
}
