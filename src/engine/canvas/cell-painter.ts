import { parseA1Range } from '../../core/coordinates/ranges';
import {
  createFormulaEvaluationBudget,
  evaluateCell,
} from '../../core/formulas/evaluator';
import type { FormulaEvaluationBudget } from '../../core/formulas/evaluator';
import { formatValue, renderFormulaValue } from '../../core/formulas/rendered-value';
import { getCellData } from '../../core/model/cells';
import { selectCellStyle } from '../../core/selectors/style';
import type { CellPoint, CellRange } from '../../core/types/coordinates';
import type { CellData, CellStyle, SheetData } from '../../core/types/workbook';
import { cellRect } from '../geometry/grid-geometry';
import type { CssRect, ViewportMetrics } from '../ports';
import type { DrawContext } from './draw-context';

const DEFAULT_STYLE: CellStyle = {
  bgcolor: '#ffffff',
  align: 'left',
  valign: 'middle',
  textwrap: false,
  color: '#0a0a0a',
  font: { name: 'Arial', size: 10, bold: false, italic: false },
};

export function configuredCellDefaultStyle(configured: CellStyle | undefined): CellStyle {
  if (configured === undefined) return DEFAULT_STYLE;
  return {
    ...DEFAULT_STYLE,
    ...configured,
    font: {
      ...DEFAULT_STYLE.font,
      ...configured.font,
    },
  };
}

export interface CellPaintSnapshot {
  readonly sheet: Readonly<SheetData>;
  readonly viewport: ViewportMetrics;
  readonly invalidCells?: readonly CellPoint[];
}

export interface CellPresentation {
  readonly cell: CellData | null;
  readonly style: CellStyle;
  readonly text: string;
  readonly printable: boolean;
}

function isMergeAnchor(point: CellPoint, viewport: ViewportMetrics): boolean {
  const merge = viewport.model.mergeAt(point);
  return merge === null
    || (merge.start.row === point.row && merge.start.column === point.column);
}

function cellSource(sheet: Readonly<SheetData>, point: CellPoint): string | number | boolean | null {
  return getCellData(sheet, point.row, point.column)?.text ?? null;
}

export function resolveCellPresentation(
  sheet: Readonly<SheetData>,
  point: CellPoint,
  print: boolean,
  budget: FormulaEvaluationBudget = createFormulaEvaluationBudget(250_000),
  defaultStyle: CellStyle = DEFAULT_STYLE,
): CellPresentation {
  const cell = getCellData(sheet, point.row, point.column);
  const style = selectCellStyle(sheet, point.row, point.column, defaultStyle);
  const printable = cell?.printable !== false;
  if (print && !printable) return { cell, style, text: '', printable };
  let rendered;
  try {
    rendered = evaluateCell(point, candidate => cellSource(sheet, candidate), budget);
  } catch {
    rendered = '#ERROR!' as const;
  }
  return {
    cell,
    style,
    text: formatValue(style.format, renderFormulaValue(rendered)),
    printable,
  };
}

const FONT_POINT_PIXELS = new Map<number, number>([
  [7.5, 10],
  [8, 11],
  [9, 12],
  [10, 13],
  [10.5, 14],
  [11, 15],
  [12, 16],
  [14, 18.7],
  [15, 20],
  [16, 21.3],
  [18, 24],
  [22, 29.3],
  [24, 32],
  [26, 34.7],
  [36, 48],
  [42, 56],
]);

function fontPixelSize(style: CellStyle, visualScale: number): number {
  const pointSize = style.font?.size ?? 10;
  return (FONT_POINT_PIXELS.get(pointSize) ?? pointSize) * visualScale;
}

function fontString(style: CellStyle, visualScale: number): string {
  const font = style.font ?? {};
  const size = fontPixelSize(style, visualScale);
  return `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${size}px ${font.name ?? 'Arial'}`;
}

function textX(rect: CssRect, style: CellStyle, visualScale: number): number {
  const padding = 5 * visualScale;
  return style.align === 'right'
    ? rect.left + rect.width - padding
    : style.align === 'center'
      ? rect.left + rect.width / 2
      : rect.left + padding;
}

function border(
  draw: DrawContext,
  rect: CssRect,
  style: CellStyle,
  visualScale: number,
): void {
  const borders = style.border;
  if (borders === undefined) return;
  const sides = [
    ['top', { x: rect.left, y: rect.top }, { x: rect.left + rect.width, y: rect.top }],
    ['right', { x: rect.left + rect.width, y: rect.top }, { x: rect.left + rect.width, y: rect.top + rect.height }],
    ['bottom', { x: rect.left, y: rect.top + rect.height }, { x: rect.left + rect.width, y: rect.top + rect.height }],
    ['left', { x: rect.left, y: rect.top }, { x: rect.left, y: rect.top + rect.height }],
  ] as const;
  for (const [side, start, end] of sides) {
    const line = borders[side];
    if (line !== undefined) {
      draw.line(start, end, {
        style: line[0],
        color: line[1] ?? '#000000',
        scale: visualScale,
      });
    }
  }
}

function marker(draw: DrawContext, rect: CssRect, color: string): void {
  const right = rect.left + rect.width - 1;
  const top = rect.top - 1;
  draw.triangle([
    { x: right - 8, y: top },
    { x: right, y: top },
    { x: right, y: top + 8 },
  ], color);
}

function dropdown(draw: DrawContext, rect: CssRect): void {
  const left = rect.left + rect.width - 15;
  const top = rect.top + rect.height - 15;
  draw.triangle([
    { x: left, y: top },
    { x: left + 8, y: top },
    { x: left + 4, y: top + 6 },
  ], 'rgba(0, 0, 0, .45)');
}

function filterHeaderRange(sheet: Readonly<SheetData>): CellRange | null {
  const reference = sheet.autofilter?.ref;
  if (reference === undefined) return null;
  try {
    const range = parseA1Range(reference);
    return { start: range.start, end: { row: range.start.row, column: range.end.column } };
  } catch {
    return null;
  }
}

function pointInRange(point: CellPoint, range: CellRange | null): boolean {
  return range !== null
    && point.row >= range.start.row && point.row <= range.end.row
    && point.column >= range.start.column && point.column <= range.end.column;
}

function wrapLines(
  draw: DrawContext,
  text: string,
  font: string,
  width: number,
  wrap: boolean,
  visualScale: number,
): readonly string[] {
  const source = text.split('\n');
  if (!wrap || width <= 0) return source;
  const output: string[] = [];
  for (const original of source) {
    if (draw.measurement.measureText(original, font) <= width) {
      output.push(original);
      continue;
    }
    let line = '';
    let lineWidth = 0;
    for (const character of original) {
      if (lineWidth >= width) {
        output.push(line);
        line = '';
        lineWidth = 0;
      }
      line += character;
      lineWidth += draw.measurement.measureText(character, font) + visualScale;
    }
    output.push(line);
  }
  return output;
}

function cellContentRect(rect: CssRect, visualScale: number): CssRect {
  return {
    left: rect.left + visualScale,
    top: rect.top + visualScale,
    width: Math.max(0, rect.width - 2 * visualScale),
    height: Math.max(0, rect.height - 2 * visualScale),
  };
}

function paintCellContent(
  draw: DrawContext,
  rect: CssRect,
  presentation: CellPresentation,
  visualScale: number,
): void {
  const style = presentation.style;
  draw.fillRect(cellContentRect(rect, visualScale), style.bgcolor ?? '#ffffff');
  if (presentation.text === '') return;
  const font = fontString(style, visualScale);
  const lines = wrapLines(
    draw,
    presentation.text,
    font,
    Math.max(0, rect.width - 12 * visualScale),
    style.textwrap === true,
    visualScale,
  );
  const x = textX(rect, style, visualScale);
  const fontSize = fontPixelSize(style, visualScale);
  const lineHeight = fontSize + 2 * visualScale;
  const textHeight = (lines.length - 1) * lineHeight;
  const padding = 5 * visualScale;
  const firstY = style.valign === 'top'
    ? rect.top + padding
    : style.valign === 'bottom'
      ? rect.top + rect.height - padding - textHeight
      : rect.top + rect.height / 2 - textHeight / 2;
  for (const [index, line] of lines.entries()) {
    const y = firstY + index * lineHeight;
    draw.text(line, { x, y }, {
      align: style.align ?? 'left',
      baseline: style.valign ?? 'middle',
      color: style.color ?? '#0a0a0a',
      font,
    });
    const width = draw.measurement.measureText(line, font);
    const startX = style.align === 'center'
      ? x - width / 2
      : style.align === 'right'
        ? x - width
        : x;
    if (style.underline === true) {
      const underlineY = style.valign === 'top'
        ? y + fontSize + 2 * visualScale
        : style.valign === 'bottom'
          ? y
          : y + fontSize / 2;
      draw.line(
        { x: startX, y: underlineY },
        { x: startX + width, y: underlineY },
        { color: style.color ?? '#0a0a0a', scale: visualScale },
      );
    }
    if (style.strike === true) {
      const strikeY = style.valign === 'top'
        ? y + fontSize / 2 + 2 * visualScale
        : style.valign === 'bottom'
          ? y - fontSize / 2
          : y;
      draw.line({ x: startX, y: strikeY }, { x: startX + width, y: strikeY }, {
        color: style.color ?? '#0a0a0a',
        scale: visualScale,
      });
    }
  }
}

export function paintCellAppearance(
  draw: DrawContext,
  rect: CssRect,
  presentation: CellPresentation,
  visualScale = 1,
  paintMarks?: () => void,
): void {
  const style = presentation.style;
  border(draw, rect, style, visualScale);
  draw.withPixelAlignedClip(cellContentRect(rect, visualScale), () => {
    paintCellContent(draw, rect, presentation, visualScale);
    paintMarks?.();
  });
}

export function paintCells(
  draw: DrawContext,
  snapshot: CellPaintSnapshot,
  cells: readonly CellPoint[],
  budget: FormulaEvaluationBudget,
  defaultStyle: CellStyle,
): void {
  const invalid = new Set((snapshot.invalidCells ?? []).map(point => `${point.row}:${point.column}`));
  const filter = filterHeaderRange(snapshot.sheet);
  for (const point of cells) {
    if (getCellData(snapshot.sheet, point.row, point.column) === null) continue;
    if (!isMergeAnchor(point, snapshot.viewport)) continue;
    const rect = cellRect(point, snapshot.viewport);
    const presentation = resolveCellPresentation(snapshot.sheet, point, false, budget, defaultStyle);
    paintCellAppearance(draw, rect, presentation, 1, () => {
      if (invalid.has(`${point.row}:${point.column}`)) marker(draw, rect, 'rgba(255, 0, 0, .65)');
      if (presentation.cell?.editable === false) marker(draw, rect, 'rgba(0, 255, 0, .85)');
      if (pointInRange(point, filter)) dropdown(draw, rect);
    });
  }
}
