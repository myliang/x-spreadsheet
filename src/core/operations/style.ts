import { iterateRange, rangeSize } from '../coordinates/ranges';
import { getCellData, setCellStyleIndex } from '../model/cells';
import { addStyleToSheet, stylesEqual } from '../model/styles';
import type {
  ClearFormatCommand,
  PaintFormatCommand,
  SetStyleCommand,
} from '../commands/workbook-command';
import type { JsonValue } from '../types/json';
import type { CellStyle, SheetData } from '../types/workbook';

type StyleCommand = SetStyleCommand | ClearFormatCommand | PaintFormatCommand;

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

function directStyle(sheet: SheetData, row: number, column: number): CellStyle | null {
  const index = getCellData(sheet, row, column)?.style;
  return index === undefined ? null : sheet.styles?.[index] ?? null;
}

function assignStyle(
  sheet: SheetData,
  row: number,
  column: number,
  style: CellStyle | null,
): SheetData {
  if (style === null) return setCellStyleIndex(sheet, row, column, null);
  const current = directStyle(sheet, row, column);
  if (current !== null && stylesEqual(current, style)) return sheet;
  const added = addStyleToSheet(sheet, style);
  return setCellStyleIndex(added.sheet, row, column, added.index);
}

function setStyle(sheet: SheetData, command: SetStyleCommand): SheetData {
  if (Object.keys(command.patch).length === 0) return sheet;
  let next = sheet;
  for (const point of iterateRange(command.selection.range)) {
    const current = directStyle(next, point.row, point.column) ?? {};
    const style = mergeStyleValue(current, command.patch as JsonValue) as CellStyle;
    next = assignStyle(next, point.row, point.column, style);
  }
  return next;
}

function clearFormat(sheet: SheetData, command: ClearFormatCommand): SheetData {
  let next = sheet;
  for (const point of iterateRange(command.selection.range)) {
    next = assignStyle(next, point.row, point.column, null);
  }
  return next;
}

function paintFormat(
  sourceSheet: SheetData,
  targetSheet: SheetData,
  command: PaintFormatCommand,
): SheetData {
  const [sourceRows, sourceColumns] = rangeSize(command.source.range);
  let next = targetSheet;
  for (const point of iterateRange(command.target.range)) {
    const row = command.source.range.start.row
      + ((point.row - command.target.range.start.row) % sourceRows);
    const column = command.source.range.start.column
      + ((point.column - command.target.range.start.column) % sourceColumns);
    next = assignStyle(next, point.row, point.column, directStyle(sourceSheet, row, column));
  }
  return next;
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
    case 'clear-format': return clearFormat(sheet, command);
    case 'paint-format': return paintFormat(sourceSheet, sheet, command);
  }
}
