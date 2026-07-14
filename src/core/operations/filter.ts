import { parseA1Range, renderA1Range } from '../coordinates/ranges';
import { cloneSheet, getCellData } from '../model/cells';
import { semanticEqual } from '../serialization/semantic-equal';
import type { CellRange } from '../types/coordinates';
import type { FilterDefinition } from '../types/options';
import type { AutoFilterItemData, SheetData } from '../types/workbook';

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
