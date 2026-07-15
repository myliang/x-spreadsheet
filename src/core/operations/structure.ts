import { parseA1Range } from '../coordinates/ranges';
import {
  deleteColumns,
  getColumnData,
  insertColumns,
} from '../model/columns';
import { deleteRows, getRowData, insertRows } from '../model/rows';
import { cloneSheet } from '../model/cells';
import type {
  HideColumnCommand,
  HideRowCommand,
  IndexedSheetCommand,
  ResizeColumnCommand,
  ResizeRowCommand,
} from '../commands/workbook-command';
import type { CellRange } from '../types/coordinates';
import type { SheetData } from '../types/workbook';

export const MAX_STRUCTURE_AXIS_CHANGES = 250_000;

export type StructureCommand =
  | IndexedSheetCommand
  | ResizeRowCommand
  | HideRowCommand
  | ResizeColumnCommand
  | HideColumnCommand;

export function rowCount(sheet: SheetData): number {
  return sheet.rows?.len ?? 100;
}

export function columnCount(sheet: SheetData): number {
  return sheet.cols?.len ?? 26;
}

export function structureRange(sheet: SheetData, command: StructureCommand): CellRange {
  switch (command.type) {
    case 'insert-row':
    case 'delete-row':
      return {
        start: { row: command.index, column: 0 },
        end: { row: command.index + (command.count ?? 1) - 1, column: Math.max(0, columnCount(sheet) - 1) },
      };
    case 'set-row-height':
    case 'set-row-hidden':
      return {
        start: { row: command.row, column: 0 },
        end: {
          row: command.row + (command.count ?? 1) - 1,
          column: Math.max(0, columnCount(sheet) - 1),
        },
      };
    case 'insert-column':
    case 'delete-column':
      return {
        start: { row: 0, column: command.index },
        end: { row: Math.max(0, rowCount(sheet) - 1), column: command.index + (command.count ?? 1) - 1 },
      };
    case 'set-column-width':
    case 'set-column-hidden':
      return {
        start: { row: 0, column: command.column },
        end: {
          row: Math.max(0, rowCount(sheet) - 1),
          column: command.column + (command.count ?? 1) - 1,
        },
      };
  }
}

export function deletionSplitsMerge(
  sheet: SheetData,
  axis: 'row' | 'column',
  start: number,
  end: number,
): boolean {
  return (sheet.merges ?? []).some(value => {
    const merge = parseA1Range(value);
    const mergeStart = axis === 'row' ? merge.start.row : merge.start.column;
    const mergeEnd = axis === 'row' ? merge.end.row : merge.end.column;
    const intersects = mergeStart <= end && start <= mergeEnd;
    const contains = start <= mergeStart && mergeEnd <= end;
    return intersects && !contains;
  });
}

export function assertStructureCommand(sheet: SheetData, command: StructureCommand): void {
  if ('count' in command && (command.count ?? 1) > MAX_STRUCTURE_AXIS_CHANGES) {
    throw new RangeError(
      `structure workload exceeds the ${MAX_STRUCTURE_AXIS_CHANGES}-index operation limit`,
    );
  }
  switch (command.type) {
    case 'insert-row':
      if (command.index > rowCount(sheet)) throw new RangeError('row insertion index exceeds row count');
      return;
    case 'delete-row': {
      const end = command.index + (command.count ?? 1) - 1;
      if (!Number.isSafeInteger(end) || end >= rowCount(sheet)) {
        throw new RangeError('row deletion exceeds row count');
      }
      if (deletionSplitsMerge(sheet, 'row', command.index, end)) {
        throw new RangeError('row deletion would split a merged range');
      }
      return;
    }
    case 'insert-column':
      if (command.index > columnCount(sheet)) {
        throw new RangeError('column insertion index exceeds column count');
      }
      return;
    case 'delete-column': {
      const end = command.index + (command.count ?? 1) - 1;
      if (!Number.isSafeInteger(end) || end >= columnCount(sheet)) {
        throw new RangeError('column deletion exceeds column count');
      }
      if (deletionSplitsMerge(sheet, 'column', command.index, end)) {
        throw new RangeError('column deletion would split a merged range');
      }
      return;
    }
    case 'set-row-height':
    case 'set-row-hidden':
      if (command.row + (command.count ?? 1) > rowCount(sheet)) {
        throw new RangeError('row exceeds row count');
      }
      return;
    case 'set-column-width':
    case 'set-column-hidden':
      if (command.column + (command.count ?? 1) > columnCount(sheet)) {
        throw new RangeError('column exceeds column count');
      }
      return;
  }
}

export function applyStructureOperation(sheet: SheetData, command: StructureCommand): SheetData {
  assertStructureCommand(sheet, command);
  switch (command.type) {
    case 'insert-row': return insertRows(sheet, command.index, command.count ?? 1);
    case 'delete-row': return deleteRows(sheet, command.index, command.index + (command.count ?? 1) - 1);
    case 'insert-column': return insertColumns(sheet, command.index, command.count ?? 1);
    case 'delete-column': return deleteColumns(
      sheet,
      command.index,
      command.index + (command.count ?? 1) - 1,
    );
    case 'set-row-height':
      return updateRows(sheet, command.row, command.count ?? 1, row => ({
        ...row,
        height: command.height,
      }));
    case 'set-row-hidden': return updateRows(sheet, command.row, command.count ?? 1, row => {
      const next = { ...row } as Record<string, unknown>;
      if (command.hidden) next.hide = true;
      else delete next.hide;
      return next;
    });
    case 'set-column-width':
      return updateColumns(sheet, command.column, command.count ?? 1, column => ({
        ...column,
        width: command.width,
      }));
    case 'set-column-hidden': return updateColumns(
      sheet,
      command.column,
      command.count ?? 1,
      column => {
        const next = { ...column } as Record<string, unknown>;
        if (command.hidden) next.hide = true;
        else delete next.hide;
        return next;
      },
    );
  }
}

function shallowEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => Object.is(left[key], right[key]));
}

function updateRows(
  sheet: SheetData,
  start: number,
  count: number,
  update: (row: Record<string, unknown>) => Record<string, unknown>,
): SheetData {
  let rows: Record<string, unknown> | null = null;
  let cloned: SheetData | null = null;
  for (let offset = 0; offset < count; offset += 1) {
    const index = start + offset;
    const current = (getRowData(sheet, index) ?? {}) as Record<string, unknown>;
    const next = update(current);
    if (shallowEqual(current, next)) continue;
    if (rows === null) {
      cloned = cloneSheet(sheet);
      rows = { ...(cloned.rows ?? { len: 100 }) };
    }
    const clonedCurrent = (rows[String(index)] ?? {}) as Record<string, unknown>;
    rows[String(index)] = update(clonedCurrent);
  }
  return rows === null ? sheet : { ...cloned!, rows } as SheetData;
}

function updateColumns(
  sheet: SheetData,
  start: number,
  count: number,
  update: (column: Record<string, unknown>) => Record<string, unknown>,
): SheetData {
  let columns: Record<string, unknown> | null = null;
  let cloned: SheetData | null = null;
  for (let offset = 0; offset < count; offset += 1) {
    const index = start + offset;
    const current = (getColumnData(sheet, index) ?? {}) as Record<string, unknown>;
    const next = update(current);
    if (shallowEqual(current, next)) continue;
    if (columns === null) {
      cloned = cloneSheet(sheet);
      columns = { ...(cloned.cols ?? { len: 26 }) };
    }
    const clonedCurrent = (columns[String(index)] ?? {}) as Record<string, unknown>;
    columns[String(index)] = update(clonedCurrent);
  }
  return columns === null ? sheet : { ...cloned!, cols: columns } as SheetData;
}
