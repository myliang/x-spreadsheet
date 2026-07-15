import type { CellRange } from '../../core/types/coordinates';
import type { SheetData } from '../../core/types/workbook';
import type { ViewportMetrics } from '../ports';
import type { DrawContext } from './draw-context';

function columnLabel(column: number): string {
  let value = column + 1;
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function rowTop(row: number, viewport: ViewportMetrics): number {
  const visualRow = viewport.model.visualIndexOfRow(row);
  return viewport.columnHeaderHeight
    + viewport.model.rowOffset(visualRow)
    - (visualRow < viewport.freeze.row ? 0 : viewport.scroll.y);
}

function columnLeft(column: number, viewport: ViewportMetrics): number {
  return viewport.rowHeaderWidth
    + viewport.model.columnOffset(column)
    - (column < viewport.freeze.column ? 0 : viewport.scroll.x);
}

function hiddenEntry(collection: unknown, index: number): boolean {
  if (collection === null || typeof collection !== 'object' || Array.isArray(collection)) return false;
  const entry = (collection as Record<string, unknown>)[String(index)];
  return entry !== null
    && typeof entry === 'object'
    && !Array.isArray(entry)
    && (entry as { readonly hide?: unknown }).hide === true;
}

export function paintHeaders(
  draw: DrawContext,
  viewport: ViewportMetrics,
  visibleRows: readonly number[],
  visibleColumns: readonly number[],
  selection?: CellRange,
  sheet?: Readonly<SheetData>,
): void {
  draw.fillRect({
    left: 0,
    top: 0,
    width: viewport.width,
    height: viewport.columnHeaderHeight,
  }, '#f4f5f8');
  draw.fillRect({
    left: 0,
    top: 0,
    width: viewport.rowHeaderWidth,
    height: viewport.height,
  }, '#f4f5f8');
  const rows = [...new Set(visibleRows)].sort((a, b) => (
    viewport.model.visualIndexOfRow(a) - viewport.model.visualIndexOfRow(b)
  ));
  const columns = [...new Set(visibleColumns)].sort((a, b) => a - b);
  for (const row of rows) {
    const top = rowTop(row, viewport);
    const height = viewport.model.rowHeight(row);
    if (selection !== undefined && row >= selection.start.row && row <= selection.end.row) {
      draw.fillRect({ left: 0, top, width: viewport.rowHeaderWidth, height }, 'rgba(75, 137, 255, 0.08)');
    }
    draw.line({ x: 0, y: top }, { x: viewport.rowHeaderWidth, y: top }, { color: '#e6e6e6' });
    const visualRow = viewport.model.visualIndexOfRow(row);
    const previousRow = visualRow === 0
      ? null
      : viewport.model.logicalRowAtVisualIndex(visualRow - 1);
    if (previousRow !== null && hiddenEntry(sheet?.rows, previousRow)) {
      draw.line(
        { x: 5, y: top + 5 },
        { x: viewport.rowHeaderWidth - 5, y: top + 5 },
        { color: '#c6c6c6' },
      );
    }
    draw.text(String(row + 1), {
      x: viewport.rowHeaderWidth / 2,
      y: top + height / 2,
    }, {
      align: 'center',
      baseline: 'middle',
      color: '#585757',
      font: '500 12px Source Sans Pro',
    });
  }
  for (const column of columns) {
    const left = columnLeft(column, viewport);
    const width = viewport.model.columnWidth(column);
    if (selection !== undefined && column >= selection.start.column && column <= selection.end.column) {
      draw.fillRect({ left, top: 0, width, height: viewport.columnHeaderHeight }, 'rgba(75, 137, 255, 0.08)');
    }
    draw.line({ x: left, y: 0 }, { x: left, y: viewport.columnHeaderHeight }, { color: '#e6e6e6' });
    if (column > 0 && hiddenEntry(sheet?.cols, column - 1)) {
      draw.line(
        { x: left + 5, y: 5 },
        { x: left + 5, y: viewport.columnHeaderHeight - 5 },
        { color: '#c6c6c6' },
      );
    }
    draw.text(columnLabel(column), {
      x: left + width / 2,
      y: viewport.columnHeaderHeight / 2,
    }, {
      align: 'center',
      baseline: 'middle',
      color: '#585757',
      font: '500 12px Source Sans Pro',
    });
  }
  draw.line(
    { x: viewport.rowHeaderWidth, y: 0 },
    { x: viewport.rowHeaderWidth, y: viewport.height },
    { color: '#e6e6e6' },
  );
  draw.line(
    { x: 0, y: viewport.columnHeaderHeight },
    { x: viewport.width, y: viewport.columnHeaderHeight },
    { color: '#e6e6e6' },
  );
  if (viewport.freeze.row > 0 || viewport.freeze.column > 0) {
    const x = viewport.rowHeaderWidth + viewport.model.columnOffset(viewport.freeze.column);
    const y = viewport.columnHeaderHeight + viewport.model.rowOffset(viewport.freeze.row);
    draw.line(
      { x, y: viewport.columnHeaderHeight },
      { x, y: viewport.height },
      { color: 'rgba(75, 137, 255, .6)' },
    );
    draw.line(
      { x: viewport.rowHeaderWidth, y },
      { x: viewport.width, y },
      { color: 'rgba(75, 137, 255, .6)' },
    );
  }
}
