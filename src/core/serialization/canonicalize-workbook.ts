import { TegoSheetException } from '../errors/tego-sheet-exception';
import type { JsonObject, JsonValue } from '../types/json';
import type { WorkbookData, WorkbookInput } from '../types/workbook';

type MutableJsonObject = Record<string, JsonValue>;
type FieldWriter = (value: unknown, path: string) => JsonValue;

interface KnownField {
  readonly name: string;
  readonly write: FieldWriter;
}

class DataValidationError extends Error {}

// Keep recursive validation and canonical cloning below engine stack limits.
const MAX_JSON_NESTING_DEPTH = 128;

const own = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function fail(path: string, expectation: string): never {
  throw new DataValidationError(`${path} ${expectation}`);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (!isJsonObject(value)) fail(path, 'must be a JSON object');
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail(path, 'must not contain symbol keys');
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !own(descriptor, 'value')) {
      fail(`${path}.${key}`, 'must be an enumerable data property');
    }
  }
  return value;
}

function arrayAt(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail(path, 'must not contain symbol keys');
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined
      || !descriptor.enumerable
      || !own(descriptor, 'value')
    ) {
      fail(`${path}[${index}]`, 'must be an enumerable data property');
    }
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === 'length') continue;
    if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
      fail(`${path}.${key}`, 'must not be a named array property');
    }
  }
  return value;
}

function validateJsonGraph(
  value: unknown,
  path: string,
  active: WeakSet<object>,
  depth: number,
): void {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    finiteNumberAt(value, path);
    return;
  }
  if (typeof value !== 'object') fail(path, 'must be JSON-compatible');
  if (depth > MAX_JSON_NESTING_DEPTH) {
    fail(path, `exceeds maximum nesting depth of ${MAX_JSON_NESTING_DEPTH}`);
  }
  if (active.has(value)) fail(path, 'contains a circular reference');

  active.add(value);
  try {
    if (Array.isArray(value)) {
      const array = arrayAt(value, path);
      array.forEach((item, index) => {
        validateJsonGraph(item, `${path}[${index}]`, active, depth + 1);
      });
      return;
    }

    const object = objectAt(value, path);
    for (const key of Object.keys(object).sort()) {
      validateJsonGraph(object[key], `${path}.${key}`, active, depth + 1);
    }
  } finally {
    active.delete(value);
  }
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'must be a string');
  return value;
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean');
  return value;
}

function finiteNumberAt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, 'must be a finite number');
  }
  return value;
}

function nonNegativeNumberAt(value: unknown, path: string): number {
  const number = finiteNumberAt(value, path);
  if (number < 0) fail(path, 'must be non-negative');
  return number;
}

function nonNegativeIntegerAt(value: unknown, path: string): number {
  const number = finiteNumberAt(value, path);
  if (!Number.isSafeInteger(number) || number < 0) {
    fail(path, 'must be a non-negative safe integer');
  }
  return number;
}

function enumAt<const Value extends string>(
  value: unknown,
  path: string,
  allowed: readonly Value[],
): Value {
  if (typeof value !== 'string' || !allowed.includes(value as Value)) {
    fail(path, `must be one of ${allowed.join(', ')}`);
  }
  return value as Value;
}

function define(target: MutableJsonObject, key: string, value: JsonValue): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function cloneJson(value: unknown, path: string): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return finiteNumberAt(value, path);
  if (Array.isArray(value)) {
    return arrayAt(value, path).map((item, index) => cloneJson(item, `${path}[${index}]`));
  }
  const source = objectAt(value, path);
  const output: MutableJsonObject = {};
  for (const key of Object.keys(source).sort()) {
    define(output, key, cloneJson(source[key], `${path}.${key}`));
  }
  return output;
}

function knownObject(
  value: unknown,
  path: string,
  fields: readonly KnownField[],
): MutableJsonObject {
  const source = objectAt(value, path);
  const output: MutableJsonObject = {};
  const knownNames = new Set(fields.map(field => field.name));

  for (const field of fields) {
    if (own(source, field.name)) {
      define(output, field.name, field.write(source[field.name], `${path}.${field.name}`));
    }
  }
  for (const key of Object.keys(source).filter(key => !knownNames.has(key)).sort()) {
    define(output, key, cloneJson(source[key], `${path}.${key}`));
  }
  return output;
}

function optionalKnownObject(
  value: unknown,
  path: string,
  fields: readonly KnownField[],
): MutableJsonObject {
  return knownObject(value, path, fields);
}

function stringArray(value: unknown, path: string, uppercase = false): JsonValue {
  return arrayAt(value, path).map((item, index) => {
    const text = stringAt(item, `${path}[${index}]`);
    return uppercase ? text.toUpperCase() : text;
  });
}

function objectArray(
  value: unknown,
  path: string,
  writer: (item: unknown, itemPath: string) => JsonValue,
): JsonValue {
  return arrayAt(value, path).map((item, index) => writer(item, `${path}[${index}]`));
}

function borderLine(value: unknown, path: string): JsonValue {
  const line = arrayAt(value, path);
  if (line.length < 1 || line.length > 2) fail(path, 'must contain a style and optional color');
  return line.map((item, index) => stringAt(item, `${path}[${index}]`));
}

function font(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'name', write: stringAt },
    { name: 'size', write: nonNegativeNumberAt },
    { name: 'bold', write: booleanAt },
    { name: 'italic', write: booleanAt },
  ]);
}

function borders(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'top', write: borderLine },
    { name: 'right', write: borderLine },
    { name: 'bottom', write: borderLine },
    { name: 'left', write: borderLine },
  ]);
}

function style(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'format', write: stringAt },
    { name: 'bgcolor', write: stringAt },
    { name: 'align', write: (item, itemPath) => enumAt(item, itemPath, ['left', 'center', 'right']) },
    { name: 'valign', write: (item, itemPath) => enumAt(item, itemPath, ['top', 'middle', 'bottom']) },
    { name: 'textwrap', write: booleanAt },
    { name: 'strike', write: booleanAt },
    { name: 'underline', write: booleanAt },
    { name: 'color', write: stringAt },
    { name: 'font', write: font },
    { name: 'border', write: borders },
  ]);
}

function cell(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'text', write: stringAt },
    { name: 'style', write: nonNegativeIntegerAt },
    {
      name: 'merge',
      write: (item, itemPath) => {
        const merge = arrayAt(item, itemPath);
        if (merge.length !== 2) fail(itemPath, 'must contain row and column spans');
        return merge.map((part, index) => nonNegativeIntegerAt(part, `${itemPath}[${index}]`));
      },
    },
    { name: 'editable', write: booleanAt },
    { name: 'printable', write: booleanAt },
    { name: 'value', write: cloneJson },
  ]);
}

function row(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'height', write: nonNegativeNumberAt },
    { name: 'hide', write: booleanAt },
    { name: 'style', write: nonNegativeIntegerAt },
    { name: 'cells', write: (item, itemPath) => sparseCollection(item, itemPath, cell) },
  ]);
}

function column(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'width', write: nonNegativeNumberAt },
    { name: 'hide', write: booleanAt },
    { name: 'style', write: nonNegativeIntegerAt },
  ]);
}

function canonicalSparseKey(key: string): string | null {
  if (!/^\d+$/.test(key)) return null;
  return BigInt(key).toString(10);
}

function sparseCollection(
  value: unknown,
  path: string,
  entryWriter: (entry: unknown, entryPath: string) => JsonValue,
  knownFields: readonly KnownField[] = [],
): JsonValue {
  const source = objectAt(value, path);
  const output: MutableJsonObject = {};
  const knownNames = new Set(knownFields.map(field => field.name));

  for (const field of knownFields) {
    if (own(source, field.name)) {
      define(output, field.name, field.write(source[field.name], `${path}.${field.name}`));
    }
  }

  const sparseEntries: { sourceKey: string; canonicalKey: string }[] = [];
  const extensionKeys: string[] = [];
  const seen = new Set<string>();
  for (const key of Object.keys(source)) {
    if (knownNames.has(key)) continue;
    const canonicalKey = canonicalSparseKey(key);
    if (canonicalKey === null) {
      extensionKeys.push(key);
      continue;
    }
    if (seen.has(canonicalKey)) {
      fail(path, `contains colliding sparse keys for index ${canonicalKey}`);
    }
    seen.add(canonicalKey);
    sparseEntries.push({ sourceKey: key, canonicalKey });
  }

  sparseEntries.sort((left, right) => {
    const leftIndex = BigInt(left.canonicalKey);
    const rightIndex = BigInt(right.canonicalKey);
    return leftIndex < rightIndex ? -1 : leftIndex > rightIndex ? 1 : 0;
  });
  for (const { sourceKey, canonicalKey } of sparseEntries) {
    define(output, canonicalKey, entryWriter(source[sourceKey], `${path}.${sourceKey}`));
  }
  for (const key of extensionKeys.sort()) {
    define(output, key, cloneJson(source[key], `${path}.${key}`));
  }
  return output;
}

function validation(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'refs', write: (item, itemPath) => stringArray(item, itemPath, true) },
    { name: 'mode', write: (item, itemPath) => enumAt(item, itemPath, ['cell']) },
    {
      name: 'type',
      write: (item, itemPath) => enumAt(item, itemPath, ['date', 'number', 'list', 'phone', 'email']),
    },
    { name: 'required', write: booleanAt },
    {
      name: 'operator',
      write: (item, itemPath) =>
        enumAt(item, itemPath, ['be', 'nbe', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in']),
    },
    { name: 'value', write: cloneJson },
  ]);
}

function filter(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'ci', write: nonNegativeIntegerAt },
    { name: 'operator', write: (item, itemPath) => enumAt(item, itemPath, ['all', 'in']) },
    {
      name: 'value',
      write: (item, itemPath) => stringArray(item, itemPath),
    },
  ]);
}

function sort(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'ci', write: nonNegativeIntegerAt },
    { name: 'order', write: (item, itemPath) => enumAt(item, itemPath, ['asc', 'desc']) },
  ]);
}

function autofilter(value: unknown, path: string): JsonValue {
  return optionalKnownObject(value, path, [
    { name: 'ref', write: (item, itemPath) => stringAt(item, itemPath).toUpperCase() },
    { name: 'filters', write: (item, itemPath) => objectArray(item, itemPath, filter) },
    {
      name: 'sort',
      write: (item, itemPath) => (item === null ? null : sort(item, itemPath)),
    },
  ]);
}

function sheet(value: unknown, index: number): JsonObject {
  const path = `workbook[${index}]`;
  const source = objectAt(value, path);
  const output = knownObject(source, path, [
    { name: 'name', write: stringAt },
    { name: 'freeze', write: (item, itemPath) => stringAt(item, itemPath).toUpperCase() },
    { name: 'styles', write: (item, itemPath) => objectArray(item, itemPath, style) },
    { name: 'merges', write: (item, itemPath) => stringArray(item, itemPath, true) },
    {
      name: 'rows',
      write: (item, itemPath) =>
        sparseCollection(item, itemPath, row, [{ name: 'len', write: nonNegativeIntegerAt }]),
    },
    {
      name: 'cols',
      write: (item, itemPath) =>
        sparseCollection(item, itemPath, column, [{ name: 'len', write: nonNegativeIntegerAt }]),
    },
    { name: 'validations', write: (item, itemPath) => objectArray(item, itemPath, validation) },
    { name: 'autofilter', write: autofilter },
  ]);

  const defaults: readonly [string, JsonValue][] = [
    ['name', `sheet${index + 1}`],
    ['freeze', 'A1'],
    ['styles', []],
    ['merges', []],
    ['rows', { len: 100 }],
    ['cols', { len: 26 }],
    ['validations', []],
    ['autofilter', {}],
  ];
  const completed: MutableJsonObject = {};
  for (const [key, fallback] of defaults) {
    define(completed, key, own(output, key) ? output[key] : fallback);
  }
  for (const key of Object.keys(output).filter(key => !own(completed, key)).sort()) {
    define(completed, key, output[key]);
  }

  const rows = completed.rows as MutableJsonObject;
  if (!own(rows, 'len')) define(rows, 'len', 100);
  const cols = completed.cols as MutableJsonObject;
  if (!own(cols, 'len')) define(cols, 'len', 26);
  return completed;
}

function invalidData(cause: unknown): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_DATA',
    message: 'Workbook data is invalid',
    recoverable: false,
    cause,
  });
}

export function canonicalizeWorkbook(input: WorkbookInput): WorkbookData {
  try {
    validateJsonGraph(
      input,
      Array.isArray(input) ? 'workbook' : 'workbook[0]',
      new WeakSet(),
      1,
    );
    const sheets: readonly unknown[] = Array.isArray(input)
      ? arrayAt(input, 'workbook')
      : [input];
    return sheets.map((item, index) => sheet(item, index));
  } catch (cause) {
    throw invalidData(cause);
  }
}

export function canonicalKey(input: WorkbookInput): string {
  return JSON.stringify(canonicalizeWorkbook(input));
}
