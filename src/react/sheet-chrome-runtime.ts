import type {
  CellStyle,
  ControllerSnapshot,
  Selection,
  SheetData,
  SheetId,
} from '../core';
import { parseA1Range } from '../core';
import {
  mountPrintPages,
  type PrintWorkbookOptions,
} from '../ui/print-workbook';

export function activeSheetData(
  snapshot: ControllerSnapshot,
  activeSheet: SheetId | null,
): SheetData | null {
  const index = snapshot.sheets.findIndex(sheet => sheet.id === activeSheet);
  return index < 0 ? null : snapshot.value[index] ?? null;
}

export function filterValuesForSelection(
  sheet: SheetData,
  selection: Selection,
): readonly string[] {
  let range = selection.range;
  if (sheet.autofilter?.ref !== undefined) {
    try {
      const filterRange = parseA1Range(sheet.autofilter.ref);
      if (
        selection.active.column >= filterRange.start.column
        && selection.active.column <= filterRange.end.column
      ) range = filterRange;
    } catch {
      // Invalid imported filter references remain inert until replaced by a valid command.
    }
  }
  const values = new Set<string>();
  for (let row = range.start.row + 1; row <= range.end.row; row += 1) {
    const rawRow = sheet.rows?.[String(row)];
    const rowRecord = rawRow !== null && typeof rawRow === 'object' && !Array.isArray(rawRow)
      ? rawRow as Readonly<Record<string, unknown>>
      : undefined;
    const cells = rowRecord?.cells;
    const rawCell = cells !== null && typeof cells === 'object' && !Array.isArray(cells)
      ? (cells as Readonly<Record<string, unknown>>)[String(selection.active.column)]
      : undefined;
    const cell = rawCell !== null && typeof rawCell === 'object' && !Array.isArray(rawCell)
      ? rawCell as Readonly<Record<string, unknown>>
      : undefined;
    values.add(typeof cell?.text === 'string' ? cell.text : '');
  }
  return [...values];
}

export function mountActiveSheetPrint(
  snapshot: ControllerSnapshot,
  activeSheet: SheetId | null,
  options: PrintWorkbookOptions,
  defaultStyle?: CellStyle,
): (() => void) | null {
  const sheet = activeSheetData(snapshot, activeSheet);
  return sheet === null ? null : mountPrintPages(sheet, options, defaultStyle);
}
