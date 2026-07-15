import { cloneSheet, setCellText } from '../model/cells';
import type { CellData, RowData, SheetData } from '../types/workbook';
import type { ClearContentsCommand, SetCellTextCommand } from '../commands/workbook-command';
import { assertCellEditable, assertRangeEditable } from './editable';

export const MAX_CLEAR_CONTENT_CELLS = 250_000;

export function assertClearContentsResourceLimit(command: ClearContentsCommand): void {
  const rows = BigInt(command.selection.range.end.row - command.selection.range.start.row + 1);
  const columns = BigInt(command.selection.range.end.column - command.selection.range.start.column + 1);
  if (rows * columns > BigInt(MAX_CLEAR_CONTENT_CELLS)) {
    throw new RangeError(`clear contents exceeds the ${MAX_CLEAR_CONTENT_CELLS}-cell operation limit`);
  }
}

export function applyCellOperation(
  sheet: SheetData,
  command: SetCellTextCommand,
): SheetData {
  assertCellEditable(sheet, command.address.row, command.address.column);
  return setCellText(sheet, command.address.row, command.address.column, command.text);
}

export function clearContents(sheet: SheetData, command: ClearContentsCommand): SheetData {
  assertClearContentsResourceLimit(command);
  assertRangeEditable(sheet, command.selection.range);
  let changed = false;
  for (let row = command.selection.range.start.row; row <= command.selection.range.end.row; row += 1) {
    const rawRow = sheet.rows?.[String(row)];
    if (rawRow === null || typeof rawRow !== 'object' || Array.isArray(rawRow)) continue;
    const rowData = rawRow as RowData;
    for (
      let column = command.selection.range.start.column;
      column <= command.selection.range.end.column;
      column += 1
    ) {
      const rawCell = rowData.cells?.[String(column)];
      if (rawCell === null || typeof rawCell !== 'object' || Array.isArray(rawCell)) continue;
      const cell = rawCell as CellData;
      if (cell.text === '' && !Object.hasOwn(cell, 'value')) continue;
      changed = true;
      break;
    }
    if (changed) break;
  }
  if (!changed) return sheet;
  const next = cloneSheet(sheet);
  for (let row = command.selection.range.start.row; row <= command.selection.range.end.row; row += 1) {
    const rawRow = next.rows?.[String(row)];
    if (rawRow === null || typeof rawRow !== 'object' || Array.isArray(rawRow)) continue;
    const rowData = rawRow as RowData;
    for (
      let column = command.selection.range.start.column;
      column <= command.selection.range.end.column;
      column += 1
    ) {
      const rawCell = rowData.cells?.[String(column)];
      if (rawCell === null || typeof rawCell !== 'object' || Array.isArray(rawCell)) continue;
      const cell = rawCell as CellData;
      if (cell.text === '' && !Object.hasOwn(cell, 'value')) continue;
      const mutable = cell as CellData as Record<string, unknown>;
      mutable.text = '';
      delete mutable.value;
    }
  }
  return next;
}
