import {
  differenceRanges,
  parseA1Range,
  rangesIntersect,
  renderA1Range,
} from '../coordinates/ranges';
import { cloneSheet } from '../model/cells';
import { semanticEqual } from '../serialization/semantic-equal';
import type { CellRange } from '../types/coordinates';
import type {
  ValidationOperator,
  ValidationRule,
  ValidationType,
} from '../types/validation';
import type { JsonValue } from '../types/json';
import type { SheetData, ValidationData } from '../types/workbook';

export interface ValueValidationResult {
  readonly valid: boolean;
  readonly message: string;
}

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const PHONE = /^[1-9]\d{10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TYPES: readonly ValidationType[] = ['date', 'number', 'list', 'phone', 'email'];
const OPERATORS: readonly ValidationOperator[] = ['be', 'nbe', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'];

function invalid(message: string): ValueValidationResult {
  return { valid: false, message };
}

function valid(): ValueValidationResult {
  return { valid: true, message: '' };
}

function dateValue(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? timestamp
    : null;
}

function scalar(value: string, type: ValidationType): string | number | null {
  if (type === 'number') return NUMBER.test(value.trim()) && Number.isFinite(Number(value))
    ? Number(value)
    : null;
  if (type === 'date') return dateValue(value.trim());
  return value;
}

function compare(
  actual: string | number,
  expected: string | number,
  operator: Exclude<ValidationOperator, 'be' | 'nbe'>,
): boolean {
  if (operator === 'eq') return actual === expected;
  if (operator === 'neq') return actual !== expected;
  if (operator === 'lt') return actual < expected;
  if (operator === 'lte') return actual <= expected;
  if (operator === 'gt') return actual > expected;
  return actual >= expected;
}

function listValues(value: ValidationRule['value']): readonly string[] {
  if (Array.isArray(value)) return value.map(String);
  return typeof value === 'string' ? value.split(',') : [];
}

export function validateValue(text: string, rule: ValidationRule): ValueValidationResult {
  if (text.trim() === '') return rule.required ? invalid('Value is required') : valid();
  if (rule.type === 'phone' && !PHONE.test(text)) return invalid('Value does not match phone format');
  if (rule.type === 'email' && !EMAIL.test(text)) return invalid('Value does not match email format');
  if (rule.type === 'list') {
    return listValues(rule.value).includes(text) ? valid() : invalid('Value is not in the list');
  }
  const actual = scalar(text, rule.type);
  if (actual === null) return invalid(`Value is not a valid ${rule.type}`);
  if (rule.operator === undefined) return valid();
  if (rule.operator === 'be' || rule.operator === 'nbe') {
    if (!Array.isArray(rule.value) || rule.value.length !== 2) {
      return invalid('Validation range is invalid');
    }
    const minimum = scalar(String(rule.value[0]), rule.type);
    const maximum = scalar(String(rule.value[1]), rule.type);
    if (minimum === null || maximum === null) return invalid('Validation range is invalid');
    const inside = actual >= minimum && actual <= maximum;
    return (rule.operator === 'be' ? inside : !inside)
      ? valid()
      : invalid(rule.operator === 'be' ? 'Value is outside the allowed range' : 'Value is inside the excluded range');
  }
  if (typeof rule.value !== 'string') return invalid('Validation comparison is invalid');
  const expected = scalar(rule.value, rule.type);
  if (expected === null) return invalid('Validation comparison is invalid');
  return compare(actual, expected, rule.operator)
    ? valid()
    : invalid(`Value does not satisfy ${rule.operator}`);
}

export function assertValidationRule(value: unknown): asserts value is ValidationRule {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('validation rule must be an object');
  }
  const rule = value as Record<string, unknown>;
  if (rule.mode !== 'cell' || !TYPES.includes(rule.type as ValidationType)
    || typeof rule.required !== 'boolean') {
    throw new TypeError('validation rule has an invalid mode, type, or required flag');
  }
  if (rule.operator !== undefined && !OPERATORS.includes(rule.operator as ValidationOperator)) {
    throw new TypeError('validation rule operator is invalid');
  }
  if ((rule.operator === 'be' || rule.operator === 'nbe')
    && (!Array.isArray(rule.value) || rule.value.length !== 2
      || rule.value.some(item => typeof item !== 'string'))) {
    throw new TypeError('between validation requires two string values');
  }
  if (rule.operator !== undefined && rule.operator !== 'be' && rule.operator !== 'nbe'
    && typeof rule.value !== 'string') {
    throw new TypeError('comparison validation requires a string value');
  }
  if (rule.type === 'list' && typeof rule.value !== 'string') {
    throw new TypeError('list validation requires a comma-separated string value');
  }
}

export function validationDataToRule(data: ValidationData): ValidationRule | null {
  if (data.mode !== 'cell' || data.type === undefined || data.required === undefined) return null;
  const operator = data.operator === 'in' ? undefined : data.operator;
  const raw = data.value;
  let value: ValidationRule['value'];
  if (data.type === 'list') {
    value = Array.isArray(raw) ? raw.map(String).join(',') : raw === undefined ? undefined : String(raw);
  } else if (operator === 'be' || operator === 'nbe') {
    value = Array.isArray(raw) && raw.length >= 2
      ? [String(raw[0]), String(raw[1])]
      : undefined;
  } else {
    value = raw === undefined ? undefined : String(raw);
  }
  return {
    mode: 'cell',
    type: data.type,
    required: data.required,
    ...(operator === undefined ? {} : { operator }),
    ...(value === undefined ? {} : { value }),
  };
}

function validationRuleToData(rule: ValidationRule, range: CellRange): ValidationData {
  const value = rule.value === undefined
    ? undefined
    : Array.isArray(rule.value) ? [...rule.value] : rule.value;
  return {
    refs: [renderA1Range(range)],
    mode: rule.mode,
    type: rule.type,
    required: rule.required,
    ...(rule.operator === undefined ? {} : { operator: rule.operator }),
    ...(value === undefined ? {} : { value: value as JsonValue }),
  };
}

function subtractRange(data: ValidationData, removed: CellRange): ValidationData | null {
  const refs: string[] = [];
  for (const raw of data.refs ?? []) {
    let range: CellRange;
    try {
      range = parseA1Range(raw);
    } catch {
      refs.push(raw);
      continue;
    }
    if (!rangesIntersect(range, removed)) refs.push(renderA1Range(range));
    else refs.push(...differenceRanges(range, removed).map(renderA1Range));
  }
  return refs.length === 0 ? null : { ...data, refs };
}

export function removeValidation(sheet: SheetData, range: CellRange): SheetData {
  const validations = (sheet.validations ?? [])
    .map(data => subtractRange(data, range))
    .filter((data): data is ValidationData => data !== null);
  const next = cloneSheet(sheet);
  (next as Record<string, unknown>).validations = validations;
  return semanticEqual(next, sheet) ? sheet : next;
}

export function setValidation(
  sheet: SheetData,
  range: CellRange,
  rule: ValidationRule,
): SheetData {
  assertValidationRule(rule);
  const withoutOverlap = removeValidation(sheet, range);
  const next = cloneSheet(withoutOverlap);
  (next as Record<string, unknown>).validations = [
    ...(next.validations ?? []),
    validationRuleToData(rule, range),
  ];
  return semanticEqual(next, sheet) ? sheet : next;
}
