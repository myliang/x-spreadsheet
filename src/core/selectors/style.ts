import type { JsonValue } from '../types/json';
import type { CellStyle, SheetData } from '../types/workbook';
import { getCellData } from '../model/cells';
import { getColumnData } from '../model/columns';
import { getRowData } from '../model/rows';
import { normalizeStyle } from '../model/styles';

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

function mergeJson(left: JsonValue, right: JsonValue): JsonValue {
  if (!isObject(left) || !isObject(right)) return right;
  const output: Record<string, JsonValue> = {};
  for (const key of Object.keys(left)) define(output, key, left[key] as JsonValue);
  for (const key of Object.keys(right)) {
    const previous = output[key];
    const value = right[key] as JsonValue;
    define(output, key, previous === undefined ? value : mergeJson(previous, value));
  }
  return output;
}

function styleAt(sheet: SheetData, index: number | undefined): CellStyle | null {
  if (index === undefined) return null;
  return sheet.styles?.[index] ?? null;
}

export function selectCellStyle(
  sheet: SheetData,
  row: number,
  column: number,
  defaultStyle: CellStyle = {},
): CellStyle {
  const styles = [
    styleAt(sheet, getColumnData(sheet, column)?.style),
    styleAt(sheet, getRowData(sheet, row)?.style),
    styleAt(sheet, getCellData(sheet, row, column)?.style),
  ].filter((style): style is CellStyle => style !== null);
  const merged = styles.reduce<JsonValue>(
    (current, style) => mergeJson(current, style),
    defaultStyle,
  );
  return normalizeStyle(merged as CellStyle);
}
