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

export function assertFilterResourceLimit(
  range: CellRange,
  filters: readonly AutoFilterItemData[],
): void {
  const dataRows = BigInt(range.end.row) - BigInt(range.start.row);
  if (dataRows < 0n) throw new RangeError('data-tool range must be normalized');
  let workload = dataRows * BigInt(filters.length);
  for (const filter of filters) {
    if (filter.operator === 'in') workload += BigInt(filter.value?.length ?? 0);
  }
  if (workload > BigInt(MAX_DATA_TOOL_CELLS)) {
    throw new RangeError(`filter workload exceeds the ${MAX_DATA_TOOL_CELLS}-cell operation limit`);
  }
}

interface CompiledFilter {
  readonly item: AutoFilterItemData;
  readonly values?: ReadonlySet<string>;
}

function compileFilters(filters: readonly AutoFilterItemData[]): readonly CompiledFilter[] {
  return filters.map(item => item.operator === 'in'
    ? { item, values: new Set(item.value ?? []) }
    : { item });
}

function includes(filter: CompiledFilter, value: string): boolean {
  if (filter.item.operator === 'all') return true;
  if (filter.item.operator === 'in') return filter.values!.has(value);
  return true;
}

function filtersForRange(
  sheet: SheetData,
  range: CellRange,
  filter: FilterDefinition,
): readonly AutoFilterItemData[] {
  const filters = (sheet.autofilter?.filters ?? []).filter(item => (
    item.ci !== undefined
    && item.ci >= range.start.column
    && item.ci <= range.end.column
  ));
  const index = filters.findIndex(item => item.ci === filter.column);
  const replacement: AutoFilterItemData = {
    ...(index < 0 ? {} : filters[index]),
    ci: filter.column,
    operator: filter.operator,
    value: [...filter.value],
  };
  if (index < 0) filters.push(replacement);
  else filters[index] = replacement;
  return filters;
}

export function assertSetFilterResourceLimit(
  sheet: SheetData,
  range: CellRange,
  filter: FilterDefinition,
): void {
  assertFilterResourceLimit(range, filtersForRange(sheet, range, filter));
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
  const filters = autofilter.filters ?? [];
  assertFilterResourceLimit(range, filters);
  if (filters.length === 0) return [];
  const compiled = compileFilters(filters);
  const excluded: number[] = [];
  for (let row = range.start.row + 1; row <= range.end.row; row += 1) {
    const accepted = compiled.every(filter => includes(
      filter,
      getCellData(sheet, row, filter.item.ci ?? range.start.column)?.text ?? '',
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
  const filters = filtersForRange(sheet, range, filter);
  assertFilterResourceLimit(range, filters);
  const next = cloneSheet(sheet);
  const previous = next.autofilter ?? {};
  (next as Record<string, unknown>).autofilter = {
    ...previous,
    ref: renderA1Range(range),
    filters: structuredClone(filters),
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
