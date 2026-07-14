import { parseA1Range } from '../coordinates/ranges';
import { evaluateCell } from '../formulas/evaluator';
import { getCellData, cloneSheet } from '../model/cells';
import { semanticEqual } from '../serialization/semantic-equal';
import type { LocaleDefinition } from '../types/changes';
import type { CellRange } from '../types/coordinates';
import type { SheetData } from '../types/workbook';
import { filteredRows } from './filter';

export type SortOrder = 'asc' | 'desc';

type SortGroup = 0 | 1 | 2;

interface Classified {
  readonly group: SortGroup;
  readonly numeric?: number;
  readonly text?: string;
}

function classify(value: unknown): Classified {
  if (value === '' || value === null || value === undefined) return { group: 2 };
  if (typeof value === 'number' && Number.isFinite(value)) return { group: 0, numeric: value };
  if (typeof value === 'string') {
    const source = value.trim();
    if (source !== '') {
      const numeric = Number(source);
      if (Number.isFinite(numeric)) return { group: 0, numeric };
    }
  }
  return { group: 1, text: String(value) };
}

function comparator(order: SortOrder, locale: LocaleDefinition): (left: unknown, right: unknown) => number {
  const collator = new Intl.Collator(locale.id, {
    usage: 'sort',
    numeric: true,
    sensitivity: 'base',
  });
  return (leftValue, rightValue) => {
    const left = classify(leftValue);
    const right = classify(rightValue);
    if (left.group !== right.group) return left.group - right.group;
    if (left.group === 2) return 0;
    const direction = order === 'asc' ? 1 : -1;
    if (left.group === 0) return direction * ((left.numeric as number) - (right.numeric as number));
    return direction * collator.compare(left.text as string, right.text as string);
  };
}

export function sortValues<T>(
  values: readonly T[],
  order: SortOrder,
  locale: LocaleDefinition,
): readonly T[] {
  const compare = comparator(order, locale);
  return values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => compare(left.value, right.value) || left.index - right.index)
    .map(entry => entry.value);
}

function renderedValue(sheet: SheetData, row: number, column: number): unknown {
  return evaluateCell({ row, column }, point => getCellData(sheet, point.row, point.column)?.text);
}

export function sortRows(
  sheet: SheetData,
  column: number,
  order: SortOrder,
  locale: LocaleDefinition,
  range: CellRange = sheet.autofilter?.ref === undefined
    ? { start: { row: 0, column }, end: { row: 0, column } }
    : parseA1Range(sheet.autofilter.ref),
): readonly number[] {
  const compare = comparator(order, locale);
  const excluded = new Set(filteredRows(sheet));
  const rows = Array.from(
    { length: Math.max(0, range.end.row - range.start.row) },
    (_, index) => range.start.row + index + 1,
  ).filter(row => !excluded.has(row));
  return rows
    .map((row, index) => ({ row, index, value: renderedValue(sheet, row, column) }))
    .sort((left, right) => compare(left.value, right.value) || left.index - right.index)
    .map(entry => entry.row);
}

export function setSort(
  sheet: SheetData,
  column: number,
  order: SortOrder,
): SheetData {
  if (sheet.autofilter?.ref === undefined) {
    throw new RangeError('sort requires an active autofilter range');
  }
  const next = cloneSheet(sheet);
  (next as Record<string, unknown>).autofilter = {
    ...next.autofilter,
    sort: { ci: column, order },
  };
  return semanticEqual(next, sheet) ? sheet : next;
}
