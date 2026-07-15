import { containsCell, rangesIntersect } from '../../core/coordinates/ranges';
import { normalizeCellRange } from '../../core/types/coordinates';
import type { CellPoint, CellRange } from '../../core/types/coordinates';
import type { GridModelPort } from '../ports';

export interface SelectionState {
  readonly kind: SelectionKind;
  readonly anchor: CellPoint;
  readonly focus: CellPoint;
  readonly active: CellPoint;
  readonly range: CellRange;
}

export type SelectionKind = 'cell' | 'row' | 'column' | 'all';

export type SelectionDirection = 'up' | 'down' | 'left' | 'right';

function frozenPoint(point: CellPoint): CellPoint {
  return Object.freeze({ row: point.row, column: point.column });
}

function frozenRange(range: CellRange): CellRange {
  return Object.freeze({
    start: frozenPoint(range.start),
    end: frozenPoint(range.end),
  });
}

function frozenSelection(
  anchor: CellPoint,
  focus: CellPoint,
  active: CellPoint,
  range: CellRange,
  kind: SelectionKind = 'cell',
): SelectionState {
  return Object.freeze({
    kind,
    anchor: frozenPoint(anchor),
    focus: frozenPoint(focus),
    active: frozenPoint(active),
    range: frozenRange(range),
  });
}

export function createSelectionState(
  anchor: CellPoint,
  focus: CellPoint = anchor,
): SelectionState {
  return frozenSelection(
    anchor,
    focus,
    focus,
    normalizeCellRange({ start: anchor, end: focus }),
  );
}

export function createRangeSelection(
  anchor: CellPoint,
  focus: CellPoint,
  range: CellRange,
  kind: SelectionKind,
  active: CellPoint = focus,
): SelectionState {
  return frozenSelection(anchor, focus, active, range, kind);
}

function clampPoint(point: CellPoint, model: GridModelPort): CellPoint {
  if (model.rowCount === 0 || model.columnCount === 0) {
    throw new RangeError('cannot select a cell in an empty grid');
  }
  if (!Number.isSafeInteger(point.row) || !Number.isSafeInteger(point.column)) {
    throw new RangeError('selection coordinates must be safe integers');
  }
  return {
    row: Math.min(Math.max(0, point.row), model.rowCount - 1),
    column: Math.min(Math.max(0, point.column), model.columnCount - 1),
  };
}

function expandMerges(range: CellRange, model: GridModelPort): CellRange {
  let expanded = range;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const merge of model.merges) {
      if (!rangesIntersect(expanded, merge)) continue;
      expanded = normalizeCellRange({
        start: {
          row: Math.min(expanded.start.row, merge.start.row),
          column: Math.min(expanded.start.column, merge.start.column),
        },
        end: {
          row: Math.max(expanded.end.row, merge.end.row),
          column: Math.max(expanded.end.column, merge.end.column),
        },
      });
    }
  }
  return expanded;
}

export function normalizeSelection(
  selection: SelectionState,
  model: GridModelPort,
): SelectionState {
  const kind = selection.kind ?? 'cell';
  const anchor = clampPoint(selection.anchor, model);
  const focus = clampPoint(selection.focus, model);
  if (kind !== 'cell') {
    const range = normalizeCellRange({
      start: clampPoint(selection.range.start, model),
      end: clampPoint(selection.range.end, model),
    });
    const requestedActive = clampPoint(selection.active, model);
    const active = containsCell(range, requestedActive) ? requestedActive : range.start;
    return frozenSelection(anchor, focus, active, range, kind);
  }
  const focusMerge = model.mergeAt(focus);
  const active = focusMerge?.start ?? focus;
  const singlePoint = anchor.row === focus.row && anchor.column === focus.column;
  const range = singlePoint && focusMerge !== null
    ? focusMerge
    : expandMerges(normalizeCellRange({ start: anchor, end: focus }), model);
  return frozenSelection(anchor, focus, active, range, kind);
}

export function moveSelection(
  selection: SelectionState,
  direction: SelectionDirection,
  model: GridModelPort,
): SelectionState {
  const normalized = normalizeSelection(selection, model);
  const current = model.mergeAt(normalized.anchor)?.start ?? normalized.anchor;
  let next = current;
  if (direction === 'up') {
    next = {
      ...current,
      row: Math.max(0, current.row - 1),
    };
  } else if (direction === 'down') {
    next = {
      ...current,
      row: Math.min(model.rowCount - 1, normalized.range.end.row + 1),
    };
  } else if (direction === 'left') {
    next = {
      ...current,
      column: Math.max(0, current.column - 1),
    };
  } else {
    next = {
      ...current,
      column: Math.min(model.columnCount - 1, normalized.range.end.column + 1),
    };
  }
  return normalizeSelection(createSelectionState(next), model);
}

export function extendSelection(
  selection: SelectionState,
  focus: CellPoint,
  model: GridModelPort,
): SelectionState {
  const current = normalizeSelection(selection, model);
  return normalizeSelection(createSelectionState(current.anchor, focus), model);
}
