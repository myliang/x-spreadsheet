import type {
  CellStyle,
  ControllerSnapshot,
  Selection,
  SheetData,
  SheetId,
} from '../core';
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
  const values = new Set<string>();
  for (let row = selection.range.start.row + 1; row <= selection.range.end.row; row += 1) {
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
