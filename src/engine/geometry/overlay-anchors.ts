import type { CellRange } from '../../core/types/coordinates';
import { normalizeCellRange } from '../../core/types/coordinates';
import { frozenQuadrants } from './frozen-pane-geometry';
import { rangeRect } from './grid-geometry';
import type { CssRect, ViewportMetrics } from '../ports';
import type { FrozenQuadrantKind } from './frozen-pane-geometry';

export interface OverlayAnchor extends CssRect {
  readonly clipped: boolean;
}

export interface PaneOverlayAnchor extends OverlayAnchor {
  readonly pane: FrozenQuadrantKind;
}

interface AxisSegment {
  readonly start: number;
  readonly end: number;
  readonly frozen: boolean;
}

function axisSegments(start: number, end: number, frozen: number): readonly AxisSegment[] {
  const segments: AxisSegment[] = [];
  if (start < frozen) {
    segments.push({ start, end: Math.min(end, frozen - 1), frozen: true });
  }
  if (end >= frozen) {
    segments.push({ start: Math.max(start, frozen), end, frozen: false });
  }
  return segments;
}

function intersect(first: CssRect, second: CssRect): CssRect | null {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.left + first.width, second.left + second.width);
  const bottom = Math.min(first.top + first.height, second.top + second.height);
  return right > left && bottom > top
    ? { left, top, width: right - left, height: bottom - top }
    : null;
}

function paneKind(rowFrozen: boolean, columnFrozen: boolean): FrozenQuadrantKind {
  if (rowFrozen && columnFrozen) return 'corner';
  if (rowFrozen) return 'top';
  if (columnFrozen) return 'left';
  return 'body';
}

export function overlayAnchors(
  range: CellRange,
  viewport: ViewportMetrics,
): readonly PaneOverlayAnchor[] {
  const normalized = normalizeCellRange(range);
  const panes = new Map(
    frozenQuadrants(viewport.freeze, viewport).map(pane => [pane.kind, pane]),
  );
  const rowSegments = axisSegments(
    normalized.start.row,
    normalized.end.row,
    viewport.freeze.row,
  );
  const columnSegments = axisSegments(
    normalized.start.column,
    normalized.end.column,
    viewport.freeze.column,
  );
  const anchors: PaneOverlayAnchor[] = [];
  for (const rows of rowSegments) {
    for (const columns of columnSegments) {
      const pane = paneKind(rows.frozen, columns.frozen);
      const paneRect = panes.get(pane);
      if (paneRect === undefined) continue;
      const source = rangeRect({
        start: { row: rows.start, column: columns.start },
        end: { row: rows.end, column: columns.end },
      }, viewport);
      const clipped = intersect(source, paneRect);
      if (clipped === null) continue;
      anchors.push({
        pane,
        ...clipped,
        clipped: clipped.left !== source.left
          || clipped.top !== source.top
          || clipped.width !== source.width
          || clipped.height !== source.height,
      });
    }
  }
  return anchors;
}

export function overlayAnchor(
  range: CellRange,
  viewport: ViewportMetrics,
): OverlayAnchor | null {
  const fragments = overlayAnchors(range, viewport);
  if (fragments.length === 0) return null;
  const left = Math.min(...fragments.map(fragment => fragment.left));
  const top = Math.min(...fragments.map(fragment => fragment.top));
  const right = Math.max(...fragments.map(fragment => fragment.left + fragment.width));
  const bottom = Math.max(...fragments.map(fragment => fragment.top + fragment.height));
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    clipped: fragments.some(fragment => fragment.clipped),
  };
}
