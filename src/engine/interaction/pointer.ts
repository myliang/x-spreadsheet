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
  getBoundingClientRect(): {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  getClientSize(): { readonly width: number; readonly height: number };
}

function clientScale(root: RootRectPort): CssPoint {
  const rect = root.getBoundingClientRect();
  const client = root.getClientSize();
  return {
    x: rect.width > 0 && client.width > 0 ? client.width / rect.width : 1,
    y: rect.height > 0 && client.height > 0 ? client.height / rect.height : 1,
  };
}

export function localPoint(
  client: Readonly<{ clientX: number; clientY: number }>,
  root: RootRectPort,
): CssPoint {
  const rect = root.getBoundingClientRect();
  const scale = clientScale(root);
  return {
    x: (client.clientX - rect.left) * scale.x,
    y: (client.clientY - rect.top) * scale.y,
  };
}

export function localDelta(
  client: Readonly<{ x: number; y: number }>,
  root: RootRectPort,
): CssPoint {
  const scale = clientScale(root);
  return { x: client.x * scale.x, y: client.y * scale.y };
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
  if (region.kind === 'cell') return extendSelection(selection, region.cell, viewport.model);
  const all = fullRange(viewport);
  if (region.kind === 'corner') {
    return createRangeSelection(
      selection.anchor,
      all.end,
      all,
      'all',
      containsCell(all, selection.active) ? selection.active : all.start,
    );
  }
  if (region.kind === 'row-header') {
    const anchor = { row: selection.anchor.row, column: 0 };
    const focus = { row: region.row, column: all.end.column };
    const range = {
      start: { row: Math.min(anchor.row, focus.row), column: 0 },
      end: { row: Math.max(anchor.row, focus.row), column: all.end.column },
    };
    return createRangeSelection(
      anchor,
      focus,
      range,
      'row',
      containsCell(range, selection.active) ? selection.active : anchor,
    );
  }
  const anchor = { row: 0, column: selection.anchor.column };
  const focus = { row: all.end.row, column: region.column };
  const range = {
    start: { row: 0, column: Math.min(anchor.column, focus.column) },
    end: { row: all.end.row, column: Math.max(anchor.column, focus.column) },
  };
  return createRangeSelection(
    anchor,
    focus,
    range,
    'column',
    containsCell(range, selection.active) ? selection.active : anchor,
  );
}

export function selectionContains(selection: SelectionState, point: CellPoint): boolean {
  return containsCell(selection.range, point);
}
