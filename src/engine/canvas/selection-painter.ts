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
  const anchors = overlayAnchors(selection, viewport);
  const handle = anchors.reduce((candidate, rect) => {
    if (candidate === null) return rect;
    const candidateEdge = candidate.left + candidate.width + candidate.top + candidate.height;
    const rectEdge = rect.left + rect.width + rect.top + rect.height;
    return rectEdge > candidateEdge ? rect : candidate;
  }, null as (typeof anchors)[number] | null);
  for (const rect of anchors) {
    if (rect.pane !== pane) continue;
    draw.fillRect(rect, 'rgba(75, 137, 255, 0.1)');
    draw.strokeRect(rect, '#4b89ff', 2);
    if (rect === handle) {
      draw.fillRect({
        left: rect.left + rect.width - 4,
        top: rect.top + rect.height - 4,
        width: 8,
        height: 8,
      }, '#4b89ff');
    }
  }
}
