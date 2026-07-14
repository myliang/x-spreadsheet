import type { JsonValue } from '../types/json';
import type { CellStyle } from '../types/workbook';

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
