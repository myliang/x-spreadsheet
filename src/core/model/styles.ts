import type { JsonValue } from '../types/json';
import type { CellStyle, SheetData } from '../types/workbook';
import { cloneSheet } from './cells';

export interface AddStyleResult {
  readonly styles: readonly CellStyle[];
  readonly index: number;
  readonly added: boolean;
}

function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (value !== null && typeof value === 'object') {
    const object = value as Readonly<Record<string, JsonValue>>;
    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(object).sort()) {
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        value: cloneJson(object[key] as JsonValue),
        writable: true,
      });
    }
    return output;
  }
  return value;
}

function stableJson(value: JsonValue): string {
  return JSON.stringify(cloneJson(value));
}

export function normalizeStyle(style: CellStyle): CellStyle {
  return cloneJson(style) as CellStyle;
}

export function stylesEqual(left: CellStyle, right: CellStyle): boolean {
  return stableJson(left) === stableJson(right);
}

export function addStyle(styles: readonly CellStyle[], style: CellStyle): AddStyleResult {
  const normalized = normalizeStyle(style);
  const index = styles.findIndex(existing => stylesEqual(existing, normalized));
  if (index >= 0) return { styles, index, added: false };
  return { styles: [...styles, normalized], index: styles.length, added: true };
}

export interface AddSheetStyleResult {
  readonly sheet: SheetData;
  readonly index: number;
  readonly added: boolean;
}

export function addStyleToSheet(sheet: SheetData, style: CellStyle): AddSheetStyleResult {
  const result = addStyle(sheet.styles ?? [], style);
  if (!result.added) return { sheet, index: result.index, added: false };
  const next = cloneSheet(sheet);
  return {
    sheet: { ...next, styles: result.styles } as unknown as SheetData,
    index: result.index,
    added: true,
  };
}
