import {
  containsRange,
  parseA1Range,
  rangeSize,
  rangesIntersect,
  renderA1Range,
} from '../coordinates/ranges';
import { cloneSheet, getCellData } from '../model/cells';
import { normalizeStyle } from '../model/styles';
import { assertRangeEditable } from './editable';
import type {
  ClearFormatCommand,
  PaintFormatCommand,
  SetBorderCommand,
  SetStyleCommand,
} from '../commands/workbook-command';
import type { CellRange } from '../types/coordinates';
import type { JsonValue } from '../types/json';
import type {
  CellBorders,
  CellStyle,
  SheetData,
} from '../types/workbook';

type StyleCommand = SetStyleCommand | SetBorderCommand | ClearFormatCommand | PaintFormatCommand;

export const MAX_STYLE_OPERATION_CELLS = 250_000;

function isObject(value: JsonValue): value is Readonly<Record<string, JsonValue>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function define(target: Record<string, JsonValue>, key: string, value: JsonValue): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function mergeStyleValue(base: JsonValue, patch: JsonValue): JsonValue {
  if (!isObject(base) || !isObject(patch)) return patch;
  const output: Record<string, JsonValue> = {};
  for (const key of Object.keys(base)) define(output, key, base[key] as JsonValue);
  for (const key of Object.keys(patch)) {
    const value = patch[key] as JsonValue;
    const previous = output[key];
    define(output, key, previous === undefined ? value : mergeStyleValue(previous, value));
  }
  return output;
}

function area(range: CellRange): bigint {
  return (BigInt(range.end.row) - BigInt(range.start.row) + 1n)
    * (BigInt(range.end.column) - BigInt(range.start.column) + 1n);
}

export function assertStyleResourceLimit(range: CellRange): void {
  if (area(range) > BigInt(MAX_STYLE_OPERATION_CELLS)) {
    throw new RangeError(
      `format range exceeds the ${MAX_STYLE_OPERATION_CELLS}-cell operation limit`,
    );
  }
}

function expandedCoordinate(start: number, size: number): number {
  const end = BigInt(start) + BigInt(size) - 1n;
  if (end > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('expanded paint-format range exceeds safe coordinates');
  }
  return Number(end);
}

export function paintFormatTargetRange(command: PaintFormatCommand): CellRange {
  const [sourceRows, sourceColumns] = rangeSize(command.source.range);
  const [targetRows, targetColumns] = rangeSize(command.target.range);
  return {
    start: command.target.range.start,
    end: {
      row: expandedCoordinate(command.target.range.start.row, Math.max(sourceRows, targetRows)),
      column: expandedCoordinate(
        command.target.range.start.column,
        Math.max(sourceColumns, targetColumns),
      ),
    },
  };
}

function streamRange(
  range: CellRange,
  visit: (row: number, column: number) => void,
): void {
  for (let row = range.start.row; row <= range.end.row; row += 1) {
    for (let column = range.start.column; column <= range.end.column; column += 1) {
      visit(row, column);
    }
  }
}

function directStyle(sheet: SheetData, row: number, column: number): CellStyle | null {
  const index = getCellData(sheet, row, column)?.style;
  return index === undefined ? null : sheet.styles?.[index] ?? null;
}

class StyleBatch {
  readonly sheet: SheetData;
  private readonly mutable: Record<string, unknown>;
  private styles: CellStyle[];
  private readonly styleIndexes = new Map<string, number>();
  private changed = false;
  private stylesChanged = false;

  constructor(source: SheetData) {
    this.sheet = cloneSheet(source);
    this.mutable = this.sheet as unknown as Record<string, unknown>;
    this.styles = [...(this.sheet.styles ?? [])];
    this.styles.forEach((style, index) => {
      const signature = this.styleSignature(style);
      if (!this.styleIndexes.has(signature)) this.styleIndexes.set(signature, index);
    });
  }

  styleAt(row: number, column: number): CellStyle | null {
    const index = this.cell(row, column, false)?.style;
    return typeof index === 'number' ? this.styles[index] ?? null : null;
  }

  assign(row: number, column: number, style: CellStyle | null): void {
    const current = this.styleAt(row, column);
    if (style === null) {
      const cell = this.cell(row, column, false);
      if (cell === null || cell.style === undefined) return;
      delete cell.style;
      this.changed = true;
      return;
    }
    const normalized = normalizeStyle(style);
    const signature = JSON.stringify(normalized);
    if (current !== null && this.styleSignature(current) === signature) return;
    let index = this.styleIndexes.get(signature);
    if (index === undefined) {
      index = this.styles.length;
      this.styles.push(normalized);
      this.styleIndexes.set(signature, index);
      this.stylesChanged = true;
    }
    const cell = this.cell(row, column, true) as Record<string, unknown>;
    if (cell.style === index) return;
    cell.style = index;
    this.changed = true;
  }

  clearMergeAnchor(range: CellRange): void {
    const cell = this.cell(range.start.row, range.start.column, false);
    if (cell?.merge === undefined) return;
    delete cell.merge;
    this.changed = true;
  }

  addMerge(range: CellRange): void {
    const rows = this.rows();
    streamRange(range, (row, column) => {
      if (row === range.start.row && column === range.start.column) return;
      const rowValue = rows[String(row)];
      if (rowValue === null || typeof rowValue !== 'object' || Array.isArray(rowValue)) return;
      const cells = (rowValue as Record<string, unknown>).cells;
      if (cells === null || typeof cells !== 'object' || Array.isArray(cells)) return;
      if (Object.hasOwn(cells, String(column))) {
        delete (cells as Record<string, unknown>)[String(column)];
        this.changed = true;
      }
    });
    const anchor = this.cell(range.start.row, range.start.column, true) as Record<string, unknown>;
    anchor.merge = [
      range.end.row - range.start.row,
      range.end.column - range.start.column,
    ];
    this.changed = true;
  }

  setMerges(merges: readonly string[]): void {
    if (JSON.stringify(this.sheet.merges ?? []) === JSON.stringify(merges)) return;
    this.mutable.merges = [...merges];
    this.changed = true;
  }

  finish(source: SheetData): SheetData {
    if (!this.changed) return source;
    if (this.stylesChanged) this.mutable.styles = this.styles;
    return this.sheet;
  }

  private rows(): Record<string, unknown> {
    const value = this.mutable.rows;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    const rows: Record<string, unknown> = { len: 100 };
    this.mutable.rows = rows;
    return rows;
  }

  private styleSignature(style: CellStyle): string {
    return JSON.stringify(normalizeStyle(style));
  }

  private cell(row: number, column: number, create: boolean): Record<string, unknown> | null {
    const rows = this.rows();
    let rowValue = rows[String(row)];
    if (rowValue === null || typeof rowValue !== 'object' || Array.isArray(rowValue)) {
      if (!create) return null;
      rowValue = { cells: {} };
      rows[String(row)] = rowValue;
    }
    const mutableRow = rowValue as Record<string, unknown>;
    let cellsValue = mutableRow.cells;
    if (cellsValue === null || typeof cellsValue !== 'object' || Array.isArray(cellsValue)) {
      if (!create) return null;
      cellsValue = {};
      mutableRow.cells = cellsValue;
    }
    const cells = cellsValue as Record<string, unknown>;
    let cellValue = cells[String(column)];
    if (cellValue === null || typeof cellValue !== 'object' || Array.isArray(cellValue)) {
      if (!create) return null;
      cellValue = {};
      cells[String(column)] = cellValue;
    }
    return cellValue as Record<string, unknown>;
  }
}

function setStyle(sheet: SheetData, command: SetStyleCommand): SheetData {
  if (Object.keys(command.patch).length === 0) return sheet;
  assertRangeEditable(sheet, command.selection.range);
  assertStyleResourceLimit(command.selection.range);
  const batch = new StyleBatch(sheet);
  streamRange(command.selection.range, (row, column) => {
    const current = batch.styleAt(row, column) ?? {};
    batch.assign(row, column, mergeStyleValue(current, command.patch as JsonValue) as CellStyle);
  });
  return batch.finish(sheet);
}

function withoutBorder(style: CellStyle): CellStyle {
  const output: Record<string, JsonValue> = {};
  for (const key of Object.keys(style)) {
    if (key !== 'border') define(output, key, style[key] as JsonValue);
  }
  return output as CellStyle;
}

function coveredMerges(
  sheet: SheetData,
  selection: CellRange,
): ReadonlyMap<number, readonly CellRange[]> {
  const rows = new Map<number, CellRange[]>();
  for (const value of sheet.merges ?? []) {
    const merge = parseA1Range(value);
    if (!rangesIntersect(merge, selection)) continue;
    const start = Math.max(merge.start.row, selection.start.row);
    const end = Math.min(merge.end.row, selection.end.row);
    for (let row = start; row <= end; row += 1) {
      const ranges = rows.get(row) ?? [];
      ranges.push(merge);
      rows.set(row, ranges);
    }
  }
  return rows;
}

function coveringMerge(
  merges: ReadonlyMap<number, readonly CellRange[]>,
  row: number,
  column: number,
): CellRange | null {
  return merges.get(row)?.find(merge => (
    merge.start.column <= column && column <= merge.end.column
  )) ?? null;
}

function borderPatch(
  command: SetBorderCommand,
  row: number,
  column: number,
  endRow = row,
  endColumn = column,
): CellBorders {
  const range = command.selection.range;
  const line = command.line;
  if (line === undefined) return {};
  const value: JsonValue = line[1] === undefined ? [line[0]] : [line[0], line[1]];
  const border: Record<string, JsonValue> = {};
  const top = row === range.start.row;
  const bottom = endRow === range.end.row;
  const left = column === range.start.column;
  const right = endColumn === range.end.column;
  switch (command.mode) {
    case 'all':
      border.top = value; border.right = value; border.bottom = value; border.left = value;
      break;
    case 'inside':
      if (endColumn < range.end.column) border.right = value;
      if (endRow < range.end.row) border.bottom = value;
      break;
    case 'outside':
      if (top) border.top = value;
      if (right) border.right = value;
      if (bottom) border.bottom = value;
      if (left) border.left = value;
      break;
    case 'horizontal':
      if (endRow < range.end.row) border.bottom = value;
      break;
    case 'vertical':
      if (endColumn < range.end.column) border.right = value;
      break;
    case 'none':
      break;
  }
  return border as CellBorders;
}

function setBorder(sheet: SheetData, command: SetBorderCommand): SheetData {
  assertRangeEditable(sheet, command.selection.range);
  assertStyleResourceLimit(command.selection.range);
  const batch = new StyleBatch(sheet);
  const merges = coveredMerges(sheet, command.selection.range);
  streamRange(command.selection.range, (row, column) => {
    const current = batch.styleAt(row, column);
    if (command.mode === 'none') {
      if (current?.border !== undefined) batch.assign(row, column, withoutBorder(current));
      return;
    }
    const merge = coveringMerge(merges, row, column);
    if (merge !== null && (row !== merge.start.row || column !== merge.start.column)) return;
    const border = borderPatch(
      command,
      row,
      column,
      merge?.end.row,
      merge?.end.column,
    );
    if (Object.keys(border).length === 0) return;
    batch.assign(
      row,
      column,
      mergeStyleValue(current ?? {}, { border } as unknown as JsonValue) as CellStyle,
    );
  });
  return batch.finish(sheet);
}

function clearFormat(sheet: SheetData, command: ClearFormatCommand): SheetData {
  assertRangeEditable(sheet, command.selection.range);
  assertStyleResourceLimit(command.selection.range);
  const batch = new StyleBatch(sheet);
  streamRange(command.selection.range, (row, column) => batch.assign(row, column, null));
  const remaining: string[] = [];
  for (const value of sheet.merges ?? []) {
    const merge = parseA1Range(value);
    if (containsRange(command.selection.range, merge)) batch.clearMergeAnchor(merge);
    else remaining.push(value);
  }
  batch.setMerges(remaining);
  return batch.finish(sheet);
}

function paintFormat(
  sourceSheet: SheetData,
  targetSheet: SheetData,
  command: PaintFormatCommand,
): SheetData {
  const target = paintFormatTargetRange(command);
  assertRangeEditable(targetSheet, target);
  assertStyleResourceLimit(target);
  if ((targetSheet.merges ?? []).some(value => rangesIntersect(parseA1Range(value), target))) {
    throw new RangeError('paint-format target intersects an existing merge');
  }

  const [sourceRows, sourceColumns] = rangeSize(command.source.range);
  const batch = new StyleBatch(targetSheet);
  streamRange(target, (row, column) => batch.assign(row, column, null));
  streamRange(command.source.range, (sourceRow, sourceColumn) => {
    const style = directStyle(sourceSheet, sourceRow, sourceColumn);
    if (style === null) return;
    const rowOffset = sourceRow - command.source.range.start.row;
    const columnOffset = sourceColumn - command.source.range.start.column;
    for (let row = target.start.row + rowOffset; row <= target.end.row; row += sourceRows) {
      for (
        let column = target.start.column + columnOffset;
        column <= target.end.column;
        column += sourceColumns
      ) {
        batch.assign(row, column, style);
      }
    }
  });

  const merges = [...(targetSheet.merges ?? [])];
  for (const value of sourceSheet.merges ?? []) {
    const sourceMerge = parseA1Range(value);
    if (!containsRange(command.source.range, sourceMerge)) continue;
    const rowOffset = sourceMerge.start.row - command.source.range.start.row;
    const columnOffset = sourceMerge.start.column - command.source.range.start.column;
    const rowSpan = sourceMerge.end.row - sourceMerge.start.row;
    const columnSpan = sourceMerge.end.column - sourceMerge.start.column;
    for (let row = target.start.row + rowOffset; row + rowSpan <= target.end.row; row += sourceRows) {
      for (
        let column = target.start.column + columnOffset;
        column + columnSpan <= target.end.column;
        column += sourceColumns
      ) {
        const merge = {
          start: { row, column },
          end: { row: row + rowSpan, column: column + columnSpan },
        };
        batch.addMerge(merge);
        merges.push(renderA1Range(merge));
      }
    }
  }
  batch.setMerges(merges);
  return batch.finish(targetSheet);
}

export function applyStyleOperation(
  sheet: SheetData,
  command: Exclude<StyleCommand, PaintFormatCommand>,
): SheetData;
export function applyStyleOperation(
  sheet: SheetData,
  command: PaintFormatCommand,
  sourceSheet: SheetData,
): SheetData;
export function applyStyleOperation(
  sheet: SheetData,
  command: StyleCommand,
  sourceSheet: SheetData = sheet,
): SheetData {
  switch (command.type) {
    case 'set-style': return setStyle(sheet, command);
    case 'set-border': return setBorder(sheet, command);
    case 'clear-format': return clearFormat(sheet, command);
    case 'paint-format': return paintFormat(sourceSheet, sheet, command);
  }
}
