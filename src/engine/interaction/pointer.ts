import { containsCell } from '../../core/coordinates/ranges';
import type { CellPoint } from '../../core/types/coordinates';
import { hitTestRegion, type HitTestRegion } from '../geometry/hit-test';
import type { CssPoint, ViewportMetrics } from '../ports';
import {
  createRangeSelection,
  createSelectionState,
  extendSelection,
  normalizeSelection,
  type SelectionState,
} from '../viewport/selection-state';

export interface RootRectPort {
  getBoundingClientRect(): { readonly left: number; readonly top: number };
}

export function localPoint(
  client: Readonly<{ clientX: number; clientY: number }>,
  root: RootRectPort,
): CssPoint {
  const rect = root.getBoundingClientRect();
  return { x: client.clientX - rect.left, y: client.clientY - rect.top };
}

export function regionAtClientPoint(
  client: Readonly<{ clientX: number; clientY: number }>,
  root: RootRectPort,
  viewport: ViewportMetrics,
): HitTestRegion | null {
  return hitTestRegion(localPoint(client, root), viewport);
}

function fullRange(viewport: ViewportMetrics) {
  return {
    start: { row: 0, column: 0 },
    end: {
      row: Math.max(0, viewport.model.rowCount - 1),
      column: Math.max(0, viewport.model.columnCount - 1),
    },
  };
}

export function selectionForRegion(
  region: HitTestRegion,
  viewport: ViewportMetrics,
): SelectionState {
  const all = fullRange(viewport);
  if (region.kind === 'corner') {
    return createRangeSelection(all.start, all.start, all, 'all');
  }
  if (region.kind === 'row-header') {
    const active = { row: region.row, column: 0 };
    return createRangeSelection(active, active, {
      start: active,
      end: { row: region.row, column: all.end.column },
    }, 'row');
  }
  if (region.kind === 'column-header') {
    const active = { row: 0, column: region.column };
    return createRangeSelection(active, active, {
      start: active,
      end: { row: all.end.row, column: region.column },
    }, 'column');
  }
  return normalizeSelection(createSelectionState(region.cell), viewport.model);
}

export function extendToRegion(
  selection: SelectionState,
  region: HitTestRegion,
  viewport: ViewportMetrics,
): SelectionState {
  if (region.kind !== 'cell') return selectionForRegion(region, viewport);
  return extendSelection(selection, region.cell, viewport.model);
}

export function selectionContains(selection: SelectionState, point: CellPoint): boolean {
  return containsCell(selection.range, point);
}

