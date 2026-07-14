import { parseA1Range, renderA1Range } from '../coordinates/ranges';
import { cloneSheet, getCellData } from '../model/cells';
import { semanticEqual } from '../serialization/semantic-equal';
import type { CellRange } from '../types/coordinates';
import type { FilterDefinition } from '../types/options';
import type { AutoFilterItemData, SheetData } from '../types/workbook';

export const MAX_DATA_TOOL_CELLS = 250_000;

export function assertDataToolResourceLimit(range: CellRange, columns = 1): void {
  if (!Number.isSafeInteger(columns) || columns < 1) {
    throw new RangeError('data-tool column count must be a positive safe integer');
  }
  const rows = BigInt(range.end.row) - BigInt(range.start.row);
  if (rows < 0n) throw new RangeError('data-tool range must be normalized');
  const limit = BigInt(MAX_DATA_TOOL_CELLS);
  if (BigInt(columns) > limit || rows * BigInt(columns) > limit) {
    throw new RangeError(`data-tool workload exceeds the ${MAX_DATA_TOOL_CELLS}-cell operation limit`);
  }
}

function includes(item: AutoFilterItemData, value: string): boolean {
  if (item.operator === 'all') return true;
  if (item.operator === 'in') return (item.value ?? []).includes(value);
  return true;
}

export function filterItems(
  sheet: SheetData,
  column: number,
  range: CellRange,
): Readonly<Record<string, number>> {
  assertDataToolResourceLimit(range);
  const output: Record<string, number> = {};
  for (let row = range.start.row + 1; row <= range.end.row; row += 1) {
    const source = getCellData(sheet, row, column)?.text ?? '';
    const text = /^\s*$/.test(source) ? '' : source;
    const count = Object.hasOwn(output, text) ? output[text] as number : 0;
    Object.defineProperty(output, text, {
      configurable: true,
      enumerable: true,
      value: count + 1,
      writable: true,
    });
  }
  return output;
}

export function filteredRows(sheet: SheetData): readonly number[] {
  const autofilter = sheet.autofilter;
  if (autofilter?.ref === undefined) return [];
  const range = parseA1Range(autofilter.ref);
  assertDataToolResourceLimit(range, Math.max(1, autofilter.filters?.length ?? 0));
  const excluded: number[] = [];
  for (let row = range.start.row + 1; row <= range.end.row; row += 1) {
    const accepted = (autofilter.filters ?? []).every(item => includes(
      item,
      getCellData(sheet, row, item.ci ?? range.start.column)?.text ?? '',
    ));
    if (!accepted) excluded.push(row);
  }
  return excluded;
}

export function setFilter(
  sheet: SheetData,
  range: CellRange,
  filter: FilterDefinition,
): SheetData {
  const existingFilters = sheet.autofilter?.filters ?? [];
  assertDataToolResourceLimit(range, Math.max(1, existingFilters.length));
  const replaces = existingFilters.some(item => item.ci === filter.column);
  assertDataToolResourceLimit(
    range,
    Math.max(1, existingFilters.length + (replaces ? 0 : 1)),
  );
  const next = cloneSheet(sheet);
  const previous = next.autofilter ?? {};
  const filters = (previous.filters ?? []).filter(item => (
    item.ci !== undefined
    && item.ci >= range.start.column
    && item.ci <= range.end.column
  ));
  const index = filters.findIndex(item => item.ci === filter.column);
  const replacement: AutoFilterItemData = {
    ci: filter.column,
    operator: filter.operator,
    value: [...filter.value],
  };
  if (index < 0) filters.push(replacement);
  else filters[index] = replacement;
  (next as Record<string, unknown>).autofilter = {
    ...previous,
    ref: renderA1Range(range),
    filters,
    sort: previous.sort?.ci !== undefined
      && previous.sort.ci >= range.start.column
      && previous.sort.ci <= range.end.column
      ? previous.sort
      : null,
  };
  return semanticEqual(next, sheet) ? sheet : next;
}

export function clearFilter(sheet: SheetData): SheetData {
  const next = cloneSheet(sheet);
  (next as Record<string, unknown>).autofilter = {};
  return semanticEqual(next, sheet) ? sheet : next;
}
