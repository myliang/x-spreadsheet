import { normalizeCellRange } from '../../core/types/coordinates';
import type { CellPoint, CellRange } from '../../core/types/coordinates';
import type { CssRect, GridModelPort, ViewportMetrics } from '../ports';

type Axis = 'row' | 'column';

const floatBits = new DataView(new ArrayBuffer(8));

function adjacentFloat(value: number, direction: -1 | 1): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return direction < 0 ? -Number.MIN_VALUE : Number.MIN_VALUE;
  floatBits.setFloat64(0, value);
  const bits = floatBits.getBigUint64(0);
  const nextBits = (value > 0) === (direction > 0) ? bits + 1n : bits - 1n;
  floatBits.setBigUint64(0, nextBits);
  return floatBits.getFloat64(0);
}

export function finiteCssSum(left: number, right: number, label: string): number {
  const value = left + right;
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  return value;
}

export function createCssRect(
  left: number,
  top: number,
  width: number,
  height: number,
): CssRect {
  if (![left, top, width, height].every(Number.isFinite) || width < 0 || height < 0) {
    throw new RangeError('CSS rectangle must have finite coordinates and dimensions');
  }
  return { left, top, width, height };
}

function axisSize(axis: Axis, index: number, model: GridModelPort): number {
  return axis === 'row' ? model.rowHeight(index) : model.columnWidth(index);
}

function axisOffset(index: number, axis: Axis, model: GridModelPort): number {
  return axis === 'row' ? model.rowOffset(index) : model.columnOffset(index);
}

export function rowOffset(row: number, model: GridModelPort): number {
  return axisOffset(row, 'row', model);
}

export function columnOffset(column: number, model: GridModelPort): number {
  return axisOffset(column, 'column', model);
}

function viewportAxisPosition(index: number, axis: Axis, viewport: ViewportMetrics): number {
  const header = axis === 'row' ? viewport.columnHeaderHeight : viewport.rowHeaderWidth;
  const scroll = axis === 'row' ? viewport.scroll.y : viewport.scroll.x;
  const frozen = axis === 'row' ? viewport.freeze.row : viewport.freeze.column;
  const content = axisOffset(index, axis, viewport.model);
  const translatedContent = content - (index < frozen ? 0 : scroll);
  return finiteCssSum(header, translatedContent, 'CSS axis position');
}

function axisRangeBounds(
  start: number,
  end: number,
  axis: Axis,
  viewport: ViewportMetrics,
): readonly [start: number, end: number] {
  const frozen = axis === 'row' ? viewport.freeze.row : viewport.freeze.column;
  const segments: Array<readonly [number, number]> = [];
  if (start < frozen) segments.push([start, Math.min(end, frozen - 1)]);
  if (end >= frozen) segments.push([Math.max(start, frozen), end]);
  const bounds = segments.map(([segmentStart, segmentEnd]) => {
    const position = viewportAxisPosition(segmentStart, axis, viewport);
    return [
      position,
      finiteCssSum(
        viewportAxisPosition(segmentEnd, axis, viewport),
        axisSize(axis, segmentEnd, viewport.model),
        'CSS axis edge',
      ),
    ] as const;
  });
  return [
    Math.min(...bounds.flatMap(value => value)),
    Math.max(...bounds.flatMap(value => value)),
  ];
}

function rangeRectRaw(range: CellRange, viewport: ViewportMetrics): CssRect {
  const normalized = normalizeCellRange(range);
  const [left, right] = axisRangeBounds(
    normalized.start.column,
    normalized.end.column,
    'column',
    viewport,
  );
  const [top, bottom] = axisRangeBounds(
    normalized.start.row,
    normalized.end.row,
    'row',
    viewport,
  );
  return createCssRect(left, top, right - left, bottom - top);
}

export function resolveMergedRange(point: CellPoint, model: GridModelPort): CellRange {
  return model.mergeAt(point) ?? { start: point, end: point };
}

export function cellRect(point: CellPoint, viewport: ViewportMetrics): CssRect {
  return rangeRectRaw(resolveMergedRange(point, viewport.model), viewport);
}

export function rangeRect(range: CellRange, viewport: ViewportMetrics): CssRect {
  return rangeRectRaw(range, viewport);
}

export function dataViewportRect(viewport: ViewportMetrics): CssRect {
  return createCssRect(
    viewport.rowHeaderWidth,
    viewport.columnHeaderHeight,
    Math.max(0, viewport.width - viewport.rowHeaderWidth),
    Math.max(0, viewport.height - viewport.columnHeaderHeight),
  );
}

function intersectRect(first: CssRect, second: CssRect): CssRect | null {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(
    finiteCssSum(first.left, first.width, 'CSS rectangle right edge'),
    finiteCssSum(second.left, second.width, 'CSS rectangle right edge'),
  );
  const bottom = Math.min(
    finiteCssSum(first.top, first.height, 'CSS rectangle bottom edge'),
    finiteCssSum(second.top, second.height, 'CSS rectangle bottom edge'),
  );
  return right > left && bottom > top
    ? createCssRect(left, top, right - left, bottom - top)
    : null;
}

export function clipToDataViewport(
  rect: CssRect,
  viewport: ViewportMetrics,
): CssRect | null {
  return intersectRect(rect, dataViewportRect(viewport));
}

export function visibleCellRange(viewport: ViewportMetrics): CellRange | null {
  if (viewport.model.rowCount === 0 || viewport.model.columnCount === 0) return null;
  if (viewport.model.rowOffset(viewport.model.rowCount) === 0
    || viewport.model.columnOffset(viewport.model.columnCount) === 0) return null;
  const { left, top, width, height } = dataViewportRect(viewport);
  if (width === 0 || height === 0) return null;
  const topLeft = findCellAtViewportPoint(
    { x: adjacentFloat(left, 1), y: adjacentFloat(top, 1) },
    viewport,
  );
  const bottomRight = findCellAtViewportPoint(
    { x: adjacentFloat(viewport.width, -1), y: adjacentFloat(viewport.height, -1) },
    viewport,
  );
  if (topLeft === null || bottomRight === null) return null;
  return normalizeCellRange({ start: topLeft, end: bottomRight });
}

function findAxisIndex(coordinate: number, axis: Axis, model: GridModelPort): number | null {
  return axis === 'row' ? model.rowAt(coordinate) : model.columnAt(coordinate);
}

function viewportAxisIndex(
  coordinate: number,
  axis: Axis,
  viewport: ViewportMetrics,
): number | null {
  const header = axis === 'row' ? viewport.columnHeaderHeight : viewport.rowHeaderWidth;
  const extent = axis === 'row' ? viewport.height : viewport.width;
  if (coordinate < header || coordinate >= extent) return null;
  const local = coordinate - header;
  const frozen = axis === 'row' ? viewport.freeze.row : viewport.freeze.column;
  const frozenSize = axisOffset(frozen, axis, viewport.model);
  const scroll = axis === 'row' ? viewport.scroll.y : viewport.scroll.x;
  return findAxisIndex(local <= frozenSize ? local : local + scroll, axis, viewport.model);
}

export function findRowAtViewportY(y: number, viewport: ViewportMetrics): number | null {
  return viewportAxisIndex(y, 'row', viewport);
}

export function findColumnAtViewportX(x: number, viewport: ViewportMetrics): number | null {
  return viewportAxisIndex(x, 'column', viewport);
}

export function findCellAtViewportPoint(
  point: Readonly<{ x: number; y: number }>,
  viewport: ViewportMetrics,
): CellPoint | null {
  if (point.x < viewport.rowHeaderWidth || point.x >= viewport.width
    || point.y < viewport.columnHeaderHeight || point.y >= viewport.height) return null;
  const column = findColumnAtViewportX(point.x, viewport);
  const row = findRowAtViewportY(point.y, viewport);
  return row === null || column === null ? null : { row, column };
}
