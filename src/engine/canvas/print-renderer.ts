import { rangesIntersect } from '../../core/coordinates/ranges';
import { createFormulaEvaluationBudget } from '../../core/formulas/evaluator';
import type { CellPoint, CellRange } from '../../core/types/coordinates';
import type { CellStyle, SheetData } from '../../core/types/workbook';
import { createSheetGridModel } from '../ports';
import type { CssRect } from '../ports';
import {
  configuredCellDefaultStyle,
  paintCellAppearance,
  resolveCellPresentation,
} from './cell-painter';
import type { CellPresentation } from './cell-painter';
import { currentDevicePixelRatio, DrawContext } from './draw-context';
import type { CanvasSurfacePort, TextMeasurementPort } from './draw-context';

const MAX_PRINT_CELLS = 250_000;
const MAX_PRINT_PAGES = 10_000;

function isolated<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(item => isolated(item))) as T;
  }
  if (value !== null && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      Object.defineProperty(output, key, {
        enumerable: true,
        value: isolated((value as Record<string, unknown>)[key]),
      });
    }
    return Object.freeze(output) as T;
  }
  return value;
}

export const PAPER_SIZES = Object.freeze({
  A3: Object.freeze({ width: Math.floor(96 * 11.69), height: Math.floor(96 * 16.54) }),
  A4: Object.freeze({ width: Math.floor(96 * 8.27), height: Math.floor(96 * 11.69) }),
  A5: Object.freeze({ width: Math.floor(96 * 5.83), height: Math.floor(96 * 8.27) }),
  B4: Object.freeze({ width: Math.floor(96 * 9.84), height: Math.floor(96 * 13.90) }),
  B5: Object.freeze({ width: Math.floor(96 * 6.93), height: Math.floor(96 * 9.84) }),
});

export type PaperSizeName = keyof typeof PAPER_SIZES;
export type PaperOrientation = 'portrait' | 'landscape';

export interface PrintLayoutOptions {
  readonly paperSize: PaperSizeName;
  readonly orientation: PaperOrientation;
  readonly padding?: number;
  readonly invalidCells?: readonly CellPoint[];
  readonly defaultStyle?: CellStyle;
}

export interface PrintPaper {
  readonly name: PaperSizeName;
  readonly orientation: PaperOrientation;
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

export interface PrintCellLayout {
  readonly row: number;
  readonly column: number;
  readonly rect: CssRect;
  readonly text: string;
  readonly printable: boolean;
  readonly style: CellStyle;
  readonly merge: CellRange | null;
  readonly invalid: boolean;
  readonly editable: boolean;
}

export interface PrintPageLayout {
  readonly index: number;
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly contentTop: number;
  readonly cells: readonly PrintCellLayout[];
}

export interface PrintLayout {
  readonly paper: PrintPaper;
  readonly scale: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
  readonly contentLeft: number;
  readonly pages: readonly PrintPageLayout[];
}

export interface PrintRenderOptions {
  readonly devicePixelRatio?: number;
  readonly measurement?: TextMeasurementPort;
}

function paper(options: Readonly<PrintLayoutOptions>): PrintPaper {
  const size = PAPER_SIZES[options.paperSize];
  if (size === undefined) throw new TypeError(`Unknown paper size: ${String(options.paperSize)}`);
  if (options.orientation !== 'portrait' && options.orientation !== 'landscape') {
    throw new TypeError(`Unknown paper orientation: ${String(options.orientation)}`);
  }
  const width = options.orientation === 'landscape' ? size.height : size.width;
  const height = options.orientation === 'landscape' ? size.width : size.height;
  const padding = options.padding ?? 50;
  if (!Number.isFinite(padding) || padding < 0 || padding * 2 >= width || padding * 2 >= height) {
    throw new RangeError('print padding must leave a positive paper content area');
  }
  return Object.freeze({
    name: options.paperSize,
    orientation: options.orientation,
    width,
    height,
    padding,
    innerWidth: width - padding * 2,
    innerHeight: height - padding * 2,
  });
}

function sparseIndex(key: string, count: number): number | null {
  if (!/^(0|[1-9]\d*)$/.test(key)) return null;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < count ? index : null;
}

function usedEnd(sheet: Readonly<SheetData>, rowCount: number, columnCount: number): CellPoint | null {
  if (rowCount === 0 || columnCount === 0) return null;
  const rows: Array<{ readonly row: number; readonly cells: object }> = [];
  for (const [rowKey, rawRow] of Object.entries(sheet.rows ?? {})) {
    const row = sparseIndex(rowKey, rowCount);
    if (row === null || rawRow === null || typeof rawRow !== 'object' || Array.isArray(rawRow)) continue;
    const cells = (rawRow as { readonly cells?: unknown }).cells;
    if (cells === null || typeof cells !== 'object' || Array.isArray(cells)) continue;
    rows.push({ row, cells });
  }
  const lastRow = rows.sort((first, second) => first.row - second.row).at(-1);
  if (lastRow === undefined) return { row: 0, column: 0 };
  const columns = Object.keys(lastRow.cells)
    .map(key => sparseIndex(key, columnCount))
    .filter((column): column is number => column !== null)
    .sort((first, second) => first - second);
  return { row: lastRow.row, column: columns.at(-1) ?? 0 };
}

interface PageRows {
  readonly start: number;
  readonly end: number;
}

function pageRows(
  sheet: Readonly<SheetData>,
  rowEnd: number,
  innerHeight: number,
  pageCount: number,
): readonly PageRows[] {
  const model = createSheetGridModel(sheet);
  const pages: PageRows[] = [];
  let row = 0;
  for (let index = 0; index < pageCount; index += 1) {
    const start = row;
    let height = 0;
    let end = row - 1;
    while (row <= rowEnd) {
      const rowHeight = model.rowHeight(row);
      height += rowHeight;
      // Legacy print preview uses a strict fit and leaves exact/oversized rows for the next page.
      if (height < innerHeight) {
        end = row;
        row += 1;
      } else {
        break;
      }
    }
    pages.push({ start, end });
  }
  return pages;
}

function mergeInterior(point: CellPoint, merge: CellRange | null): boolean {
  return merge !== null
    && (point.row !== merge.start.row || point.column !== merge.start.column);
}

function logicalRect(
  point: CellPoint,
  merge: CellRange | null,
  model: ReturnType<typeof createSheetGridModel>,
): CssRect {
  const range = merge ?? { start: point, end: point };
  const left = model.columnOffset(range.start.column);
  const top = model.rowOffset(range.start.row);
  return {
    left,
    top,
    width: model.columnOffset(range.end.column + 1) - left,
    height: model.rowOffset(range.end.row + 1) - top,
  };
}

function buildPageCells(
  sheet: Readonly<SheetData>,
  rows: PageRows,
  columnEnd: number,
  invalidCells: ReadonlySet<string>,
  defaultStyle: CellStyle,
): readonly PrintCellLayout[] {
  if (rows.end < rows.start) return [];
  const model = createSheetGridModel(sheet);
  const rowRange: CellRange = {
    start: { row: rows.start, column: 0 },
    end: { row: rows.end, column: columnEnd },
  };
  const cells: PrintCellLayout[] = [];
  const seen = new Set<string>();
  const budget = createFormulaEvaluationBudget(250_000);
  const add = (point: CellPoint): void => {
    const key = `${point.row}:${point.column}`;
    if (seen.has(key)) return;
    seen.add(key);
    const merge = model.mergeAt(point);
    if (mergeInterior(point, merge)) return;
    const presentation = resolveCellPresentation(sheet, point, true, budget, defaultStyle);
    if (presentation.cell === null) return;
    cells.push({
      row: point.row,
      column: point.column,
      rect: logicalRect(point, merge, model),
      text: presentation.text,
      printable: presentation.printable,
      style: presentation.style,
      merge,
      invalid: invalidCells.has(key),
      editable: presentation.cell.editable !== false,
    });
  };
  for (let row = rows.start; row <= rows.end; row += 1) {
    for (let column = 0; column <= columnEnd; column += 1) add({ row, column });
  }
  for (const merge of model.merges) {
    if (rangesIntersect(rowRange, merge)) add(merge.start);
  }
  return cells;
}

export function createPrintLayout(
  sheet: Readonly<SheetData>,
  options: Readonly<PrintLayoutOptions>,
): PrintLayout {
  const printPaper = paper(options);
  const model = createSheetGridModel(sheet);
  const end = usedEnd(sheet, model.rowCount, model.columnCount);
  if (end === null) {
    return isolated({
      paper: printPaper,
      scale: 1,
      contentWidth: 0,
      contentHeight: 0,
      contentLeft: printPaper.padding + printPaper.innerWidth / 2,
      pages: [{
        index: 0,
        rowStart: 0,
        rowEnd: -1,
        contentTop: 0,
        cells: [],
      }],
    });
  }
  const cellCount = BigInt(end.row + 1) * BigInt(end.column + 1);
  if (cellCount > BigInt(MAX_PRINT_CELLS)) {
    throw new RangeError(`print layout exceeds the ${MAX_PRINT_CELLS}-cell limit`);
  }
  const contentWidth = model.columnOffset(end.column + 1);
  const contentHeight = model.rowOffset(end.row + 1);
  const rawScale = contentWidth > 0 ? printPaper.innerWidth / contentWidth : 1;
  const scale = Math.min(1, rawScale);
  const contentLeft = printPaper.padding + (rawScale > 1
    ? (printPaper.innerWidth - contentWidth) / 2
    : 0);
  const pageCount = Math.floor(contentHeight / printPaper.innerHeight) + 1;
  if (!Number.isSafeInteger(pageCount) || pageCount > MAX_PRINT_PAGES) {
    throw new RangeError(`print layout exceeds the ${MAX_PRINT_PAGES}-page limit`);
  }
  const rows = pageRows(sheet, end.row, printPaper.innerHeight, pageCount);
  const invalidCells = new Set((options.invalidCells ?? []).map(point => `${point.row}:${point.column}`));
  const defaultStyle = configuredCellDefaultStyle(options.defaultStyle);
  const pages = rows.map((range, index) => Object.freeze({
    index,
    rowStart: range.start,
    rowEnd: range.end,
    contentTop: model.rowOffset(Math.min(range.start, model.rowCount)),
    cells: Object.freeze(buildPageCells(sheet, range, end.column, invalidCells, defaultStyle)),
  }));
  return isolated({
    paper: printPaper,
    scale,
    contentWidth,
    contentHeight,
    contentLeft,
    pages: Object.freeze(pages),
  });
}

function canvasMeasurement(canvas: CanvasSurfacePort): TextMeasurementPort {
  return {
    measureText(text, font) {
      const context = canvas.getContext('2d');
      if (context === null) return text.length * 7;
      context.save();
      context.font = font;
      const width = context.measureText(text).width;
      context.restore();
      return width;
    },
  };
}

function printPresentation(cell: PrintCellLayout): CellPresentation {
  return { cell: null, style: cell.style, text: cell.text, printable: cell.printable };
}

function printMarker(draw: DrawContext, rect: CssRect, color: string, scale: number): void {
  const right = rect.left + rect.width - scale;
  const top = rect.top - scale;
  draw.triangle([
    { x: right - 8 * scale, y: top },
    { x: right, y: top },
    { x: right, y: top + 8 * scale },
  ], color);
}

export function renderPrintPage(
  layout: PrintLayout,
  pageIndex: number,
  canvas: CanvasSurfacePort,
  options: Readonly<PrintRenderOptions> = {},
): void {
  const page = layout.pages[pageIndex];
  if (page === undefined) throw new RangeError('print page index is outside the layout');
  const draw = new DrawContext(
    canvas,
    options.devicePixelRatio ?? currentDevicePixelRatio(),
    options.measurement ?? canvasMeasurement(canvas),
  );
  draw.resize(layout.paper.width, layout.paper.height);
  draw.clear(layout.paper.width, layout.paper.height);
  draw.fillRect({ left: 0, top: 0, width: layout.paper.width, height: layout.paper.height }, '#ffffff');
  draw.withClip({
    left: layout.paper.padding,
    top: layout.paper.padding,
    width: layout.paper.innerWidth,
    height: layout.paper.innerHeight,
  }, () => {
    for (const cell of page.cells) {
      const rect = {
        left: layout.contentLeft + cell.rect.left * layout.scale,
        top: layout.paper.padding + (cell.rect.top - page.contentTop) * layout.scale,
        width: cell.rect.width * layout.scale,
        height: cell.rect.height * layout.scale,
      };
      paintCellAppearance(draw, rect, printPresentation(cell), layout.scale, () => {
        if (cell.invalid) printMarker(draw, rect, 'rgba(255, 0, 0, .65)', layout.scale);
        if (!cell.editable) printMarker(draw, rect, 'rgba(0, 255, 0, .85)', layout.scale);
      });
    }
  });
}

export class PrintRenderer {
  createLayout(sheet: Readonly<SheetData>, options: Readonly<PrintLayoutOptions>): PrintLayout {
    return createPrintLayout(sheet, options);
  }

  renderPage(
    layout: PrintLayout,
    pageIndex: number,
    canvas: CanvasSurfacePort,
    options: Readonly<PrintRenderOptions> = {},
  ): void {
    renderPrintPage(layout, pageIndex, canvas, options);
  }
}
