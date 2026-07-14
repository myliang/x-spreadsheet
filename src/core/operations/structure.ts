import { parseA1Range } from '../coordinates/ranges';
import {
  deleteColumns,
  getColumnData,
  insertColumns,
  setColumnHidden,
  setColumnWidth,
} from '../model/columns';
import { deleteRows, getRowData, insertRows, setRowHeight, setRowHidden } from '../model/rows';
import type {
  HideColumnCommand,
  HideRowCommand,
  IndexedSheetCommand,
  ResizeColumnCommand,
  ResizeRowCommand,
} from '../commands/workbook-command';
import type { CellRange } from '../types/coordinates';
import type { SheetData } from '../types/workbook';

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
        end: { row: command.row, column: Math.max(0, columnCount(sheet) - 1) },
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
        end: { row: Math.max(0, rowCount(sheet) - 1), column: command.column },
      };
  }
}

function deletionSplitsMerge(
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
      if (command.row >= rowCount(sheet)) throw new RangeError('row exceeds row count');
      return;
    case 'set-column-width':
    case 'set-column-hidden':
      if (command.column >= columnCount(sheet)) throw new RangeError('column exceeds column count');
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
      return getRowData(sheet, command.row)?.height === command.height
        ? sheet
        : setRowHeight(sheet, command.row, command.height);
    case 'set-row-hidden':
      return (command.hidden
        ? getRowData(sheet, command.row)?.hide === true
        : getRowData(sheet, command.row)?.hide === undefined)
        ? sheet
        : setRowHidden(sheet, command.row, command.hidden);
    case 'set-column-width':
      return getColumnData(sheet, command.column)?.width === command.width
        ? sheet
        : setColumnWidth(sheet, command.column, command.width);
    case 'set-column-hidden':
      return (command.hidden
        ? getColumnData(sheet, command.column)?.hide === true
        : getColumnData(sheet, command.column)?.hide === undefined)
        ? sheet
        : setColumnHidden(sheet, command.column, command.hidden);
  }
}
