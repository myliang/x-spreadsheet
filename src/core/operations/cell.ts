import { cloneSheet, getCellData, setCellText } from '../model/cells';
import type { CellData, RowData, SheetData } from '../types/workbook';
import type {
  ClearContentsCommand,
  SetCellMetadataCommand,
  SetCellTextCommand,
} from '../commands/workbook-command';
import { assertCellEditable, assertRangeEditable } from './editable';

export const MAX_CLEAR_CONTENT_CELLS = 250_000;
export const MAX_CELL_METADATA_CELLS = 250_000;

function selectionArea(command: ClearContentsCommand | SetCellMetadataCommand): bigint {
  const rows = BigInt(command.selection.range.end.row - command.selection.range.start.row + 1);
  const columns = BigInt(command.selection.range.end.column - command.selection.range.start.column + 1);
  return rows * columns;
}

export function assertClearContentsResourceLimit(command: ClearContentsCommand): void {
  if (selectionArea(command) > BigInt(MAX_CLEAR_CONTENT_CELLS)) {
    throw new RangeError(`clear contents exceeds the ${MAX_CLEAR_CONTENT_CELLS}-cell operation limit`);
  }
}

export function assertCellMetadataResourceLimit(command: SetCellMetadataCommand): void {
  if (selectionArea(command) > BigInt(MAX_CELL_METADATA_CELLS)) {
    throw new RangeError(`cell metadata exceeds the ${MAX_CELL_METADATA_CELLS}-cell operation limit`);
  }
}

export function applyCellOperation(
  sheet: SheetData,
  command: SetCellTextCommand,
): SheetData {
  assertCellEditable(sheet, command.address.row, command.address.column);
  return setCellText(sheet, command.address.row, command.address.column, command.text);
}

function hasClearableContents(cell: CellData): boolean {
  return (cell.text !== undefined && cell.text !== '') || Object.hasOwn(cell, 'value');
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
      if (!hasClearableContents(cell)) continue;
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
      if (!hasClearableContents(cell)) continue;
      const mutable = cell as CellData as Record<string, unknown>;
      delete mutable.text;
      delete mutable.value;
    }
  }
  return next;
}

export function setCellMetadata(sheet: SheetData, command: SetCellMetadataCommand): SheetData {
  assertCellMetadataResourceLimit(command);
  let changed = false;
  for (let row = command.selection.range.start.row; row <= command.selection.range.end.row; row += 1) {
    for (
      let column = command.selection.range.start.column;
      column <= command.selection.range.end.column;
      column += 1
    ) {
      if (getCellData(sheet, row, column)?.[command.property] !== command.value) {
        changed = true;
        break;
      }
    }
    if (changed) break;
  }
  if (!changed) return sheet;

  const next = cloneSheet(sheet);
  const mutableSheet = next as SheetData as Record<string, unknown>;
  const rows = { ...(next.rows ?? { len: 100 }) } as Record<string, unknown>;
  mutableSheet.rows = rows;
  for (let row = command.selection.range.start.row; row <= command.selection.range.end.row; row += 1) {
    const rawRow = rows[String(row)];
    const currentRow = rawRow !== null && typeof rawRow === 'object' && !Array.isArray(rawRow)
      ? rawRow as RowData
      : {};
    const mutableRow = { ...currentRow } as Record<string, unknown>;
    const cells = { ...(currentRow.cells ?? {}) } as Record<string, unknown>;
    mutableRow.cells = cells;
    rows[String(row)] = mutableRow;
    for (
      let column = command.selection.range.start.column;
      column <= command.selection.range.end.column;
      column += 1
    ) {
      const rawCell = cells[String(column)];
      const currentCell = rawCell !== null && typeof rawCell === 'object' && !Array.isArray(rawCell)
        ? rawCell as CellData
        : {};
      cells[String(column)] = { ...currentCell, [command.property]: command.value };
    }
  }
  return next;
}
