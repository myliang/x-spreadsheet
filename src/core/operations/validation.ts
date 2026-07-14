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

const PHONE = /^[1-9]\d{10}$/;
const EMAIL = /w+([-+.]w+)*@w+([-.]w+)*.w+([-.]w+)*/;

const TYPES: readonly ValidationType[] = ['date', 'number', 'list', 'phone', 'email'];
const OPERATORS: readonly ValidationOperator[] = ['be', 'nbe', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'];

function invalid(message: string): ValueValidationResult {
  return { valid: false, message };
}

function valid(): ValueValidationResult {
  return { valid: true, message: '' };
}

type LegacyValue = string | number | Date;

function scalar(value: string, type: ValidationType): LegacyValue {
  if (type === 'number') return Number(value);
  if (type === 'date') return new Date(value);
  return value;
}

function relational(value: LegacyValue): string | number {
  return value instanceof Date ? value.getTime() : value;
}

function compare(
  actual: LegacyValue,
  expected: LegacyValue,
  operator: Exclude<ValidationOperator, 'be' | 'nbe'>,
): boolean {
  if (operator === 'eq') return actual === expected;
  if (operator === 'neq') return actual !== expected;
  const left = relational(actual);
  const right = relational(expected);
  if (operator === 'lt') return left < right;
  if (operator === 'lte') return left <= right;
  if (operator === 'gt') return left > right;
  return left >= right;
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
  if (rule.operator === undefined) return valid();
  const actual = scalar(text, rule.type);
  if (rule.operator === 'be' || rule.operator === 'nbe') {
    if (!Array.isArray(rule.value) || rule.value.length !== 2) {
      return invalid('Validation range is invalid');
    }
    const minimum = scalar(String(rule.value[0]), rule.type);
    const maximum = scalar(String(rule.value[1]), rule.type);
    const inside = relational(actual) >= relational(minimum)
      && relational(actual) <= relational(maximum);
    return (rule.operator === 'be' ? inside : !inside)
      ? valid()
      : invalid(rule.operator === 'be' ? 'Value is outside the allowed range' : 'Value is inside the excluded range');
  }
  if (typeof rule.value !== 'string') return invalid('Validation comparison is invalid');
  const expected = scalar(rule.value, rule.type);
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

function equalValues(left: JsonValue | undefined, right: ValidationRule['value']): boolean {
  if (Array.isArray(left)) {
    if (typeof right !== 'string' && !Array.isArray(right)) return false;
    return left.length === right.length
      && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

function sameValidator(data: ValidationData, rule: ValidationRule): boolean {
  return data.type === rule.type
    && data.required === rule.required
    && data.operator === rule.operator
    && equalValues(data.value, rule.value);
}

function refsWithoutRange(refs: readonly string[] | undefined, removed: CellRange): readonly string[] {
  const output: string[] = [];
  for (const raw of refs ?? []) {
    let range: CellRange;
    try {
      range = parseA1Range(raw);
    } catch {
      output.push(raw);
      continue;
    }
    if (!rangesIntersect(range, removed)) output.push(renderA1Range(range));
    else output.push(...differenceRanges(range, removed).map(renderA1Range));
  }
  return output;
}

function subtractRange(data: ValidationData, removed: CellRange): ValidationData | null {
  const refs = refsWithoutRange(data.refs, removed);
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
  const next = cloneSheet(sheet);
  const validations = [...(next.validations ?? [])];
  const existing = validations.findIndex(data => sameValidator(data, rule));
  if (existing >= 0) {
    const data = validations[existing] as ValidationData;
    validations[existing] = {
      ...data,
      refs: [...refsWithoutRange(data.refs, range), renderA1Range(range)],
    };
  } else {
    validations.push(validationRuleToData(rule, range));
  }
  (next as Record<string, unknown>).validations = validations;
  return semanticEqual(next, sheet) ? sheet : next;
}
