import type { CellPoint, CellRange } from '../types/coordinates';
import { normalizeCellRange } from '../types/coordinates';
import { parseA1, renderA1, shiftA1 } from './a1';
import type { CoordinateDelta } from './a1';

export function normalizeRange(range: CellRange): CellRange {
  return normalizeCellRange(range);
}

export function parseA1Range(input: string): CellRange {
  const parts = input.split(':');
  if (parts.length < 1 || parts.length > 2 || parts.some(part => part.length === 0)) {
    throw new TypeError(`Invalid A1 range: ${input}`);
  }
  const start = parseA1(parts[0] as string);
  const end = parts.length === 2 ? parseA1(parts[1] as string) : start;
  return normalizeRange({ start, end });
}

export function renderA1Range(range: CellRange): string {
  const normalized = normalizeRange(range);
  const start = renderA1(normalized.start);
  const end = renderA1(normalized.end);
  return start === end ? start : `${start}:${end}`;
}

export function shiftA1Range(input: string, delta: CoordinateDelta): string {
  const parts = input.split(':');
  if (parts.length < 1 || parts.length > 2 || parts.some(part => part.length === 0)) {
    throw new TypeError(`Invalid A1 range: ${input}`);
  }
  const shifted = parts.map(part => shiftA1(part, delta));
  return shifted.join(':');
}

export function containsCell(range: CellRange, point: CellPoint): boolean {
  const normalized = normalizeRange(range);
  return point.row >= normalized.start.row
    && point.row <= normalized.end.row
    && point.column >= normalized.start.column
    && point.column <= normalized.end.column;
}

export function containsRange(container: CellRange, candidate: CellRange): boolean {
  const outer = normalizeRange(container);
  const inner = normalizeRange(candidate);
  return containsCell(outer, inner.start) && containsCell(outer, inner.end);
}

export function rangesIntersect(left: CellRange, right: CellRange): boolean {
  return intersectRanges(left, right) !== null;
}

export function intersectRanges(left: CellRange, right: CellRange): CellRange | null {
  const a = normalizeRange(left);
  const b = normalizeRange(right);
  const start = {
    row: Math.max(a.start.row, b.start.row),
    column: Math.max(a.start.column, b.start.column),
  };
  const end = {
    row: Math.min(a.end.row, b.end.row),
    column: Math.min(a.end.column, b.end.column),
  };
  return start.row <= end.row && start.column <= end.column ? { start, end } : null;
}

export function unionRanges(left: CellRange, right: CellRange): CellRange {
  const a = normalizeRange(left);
  const b = normalizeRange(right);
  return {
    start: {
      row: Math.min(a.start.row, b.start.row),
      column: Math.min(a.start.column, b.start.column),
    },
    end: {
      row: Math.max(a.end.row, b.end.row),
      column: Math.max(a.end.column, b.end.column),
    },
  };
}

export function differenceRanges(range: CellRange, removed: CellRange): readonly CellRange[] {
  const source = normalizeRange(range);
  const intersection = intersectRanges(source, removed);
  if (intersection === null) return [source];
  const output: CellRange[] = [];
  if (source.start.row < intersection.start.row) {
    output.push({
      start: source.start,
      end: { row: intersection.start.row - 1, column: source.end.column },
    });
  }
  if (intersection.end.row < source.end.row) {
    output.push({
      start: { row: intersection.end.row + 1, column: source.start.column },
      end: source.end,
    });
  }
  if (source.start.column < intersection.start.column) {
    output.push({
      start: { row: intersection.start.row, column: source.start.column },
      end: { row: intersection.end.row, column: intersection.start.column - 1 },
    });
  }
  if (intersection.end.column < source.end.column) {
    output.push({
      start: { row: intersection.start.row, column: intersection.end.column + 1 },
      end: { row: intersection.end.row, column: source.end.column },
    });
  }
  return output;
}

export function rangeSize(range: CellRange): readonly [rows: number, columns: number] {
  const normalized = normalizeRange(range);
  return [
    normalized.end.row - normalized.start.row + 1,
    normalized.end.column - normalized.start.column + 1,
  ];
}

export function rangesEqual(left: CellRange, right: CellRange): boolean {
  const a = normalizeRange(left);
  const b = normalizeRange(right);
  return a.start.row === b.start.row
    && a.start.column === b.start.column
    && a.end.row === b.end.row
    && a.end.column === b.end.column;
}

export function iterateRange(range: CellRange): readonly CellPoint[] {
  const normalized = normalizeRange(range);
  const points: CellPoint[] = [];
  for (let row = normalized.start.row; row <= normalized.end.row; row += 1) {
    for (let column = normalized.start.column; column <= normalized.end.column; column += 1) {
      points.push({ row, column });
    }
  }
  return points;
}
