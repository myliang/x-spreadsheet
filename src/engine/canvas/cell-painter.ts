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
): CellPresentation {
  const cell = getCellData(sheet, point.row, point.column);
  const style = selectCellStyle(sheet, point.row, point.column, DEFAULT_STYLE);
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

function fontString(style: CellStyle): string {
  const font = style.font ?? {};
  const size = (font.size ?? 10) * 96 / 72;
  return `${font.italic ? 'italic ' : ''}${font.bold ? 'bold ' : ''}${size}px ${font.name ?? 'Arial'}`;
}

function textPoint(rect: CssRect, style: CellStyle, visualScale: number): { x: number; y: number } {
  const padding = 5 * visualScale;
  const x = style.align === 'right'
    ? rect.left + rect.width - padding
    : style.align === 'center'
      ? rect.left + rect.width / 2
      : rect.left + padding;
  const y = style.valign === 'top'
    ? rect.top + padding
    : style.valign === 'bottom'
      ? rect.top + rect.height - padding
      : rect.top + rect.height / 2;
  return { x, y };
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
): readonly string[] {
  const source = text.split('\n');
  if (!wrap || width <= 0) return source;
  const output: string[] = [];
  for (const original of source) {
    let line = '';
    for (const character of original) {
      if (line !== '' && draw.measurement.measureText(line + character, font) > width) {
        output.push(line);
        line = '';
      }
      line += character;
    }
    output.push(line);
  }
  return output;
}

export function paintCellAppearance(
  draw: DrawContext,
  rect: CssRect,
  presentation: CellPresentation,
  visualScale = 1,
): void {
  const style = presentation.style;
  const inset = visualScale;
  draw.fillRect({
    left: rect.left + inset,
    top: rect.top + inset,
    width: Math.max(0, rect.width - 2 * inset),
    height: Math.max(0, rect.height - 2 * inset),
  }, style.bgcolor ?? '#ffffff');
  border(draw, rect, style, visualScale);
  if (presentation.text === '') return;
  const font = fontString(style);
  const lines = wrapLines(
    draw,
    presentation.text,
    font,
    Math.max(0, rect.width - 10 * visualScale),
    style.textwrap === true,
  );
  const point = textPoint(rect, style, visualScale);
  const lineHeight = (style.font?.size ?? 10) * 96 / 72 + 2 * visualScale;
  const firstY = point.y - ((lines.length - 1) * lineHeight / 2);
  for (const [index, line] of lines.entries()) {
    const y = firstY + index * lineHeight;
    draw.text(line, { x: point.x, y }, {
      align: style.align ?? 'left',
      baseline: style.valign ?? 'middle',
      color: style.color ?? '#0a0a0a',
      font,
    });
    const width = draw.measurement.measureText(line, font);
    const startX = style.align === 'center'
      ? point.x - width / 2
      : style.align === 'right'
        ? point.x - width
        : point.x;
    if (style.underline === true) {
      draw.line(
        { x: startX, y: y + 2 * visualScale },
        { x: startX + width, y: y + 2 * visualScale },
        {
        color: style.color ?? '#0a0a0a',
        scale: visualScale,
        },
      );
    }
    if (style.strike === true) {
      draw.line({ x: startX, y }, { x: startX + width, y }, {
        color: style.color ?? '#0a0a0a',
        scale: visualScale,
      });
    }
  }
}

export function paintCells(
  draw: DrawContext,
  snapshot: CellPaintSnapshot,
  cells: readonly CellPoint[],
  budget: FormulaEvaluationBudget,
): void {
  const invalid = new Set((snapshot.invalidCells ?? []).map(point => `${point.row}:${point.column}`));
  const filter = filterHeaderRange(snapshot.sheet);
  for (const point of cells) {
    if (!isMergeAnchor(point, snapshot.viewport)) continue;
    const rect = cellRect(point, snapshot.viewport);
    const presentation = resolveCellPresentation(snapshot.sheet, point, false, budget);
    paintCellAppearance(draw, rect, presentation);
    if (invalid.has(`${point.row}:${point.column}`)) marker(draw, rect, 'rgba(255, 0, 0, .65)');
    if (presentation.cell?.editable === false) marker(draw, rect, 'rgba(0, 255, 0, .85)');
    if (pointInRange(point, filter)) dropdown(draw, rect);
  }
}
