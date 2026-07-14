import { serializeWorkbook } from '../serialization/serialize-workbook';
import type { CellData, CellsData, RowData, RowsData, SheetData } from '../types/workbook';

function assertIndex(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

export function cloneSheet(sheet: SheetData): SheetData {
  return serializeWorkbook([sheet])[0] as SheetData;
}

function rowAt(sheet: SheetData, row: number): RowData | null {
  const value = sheet.rows?.[String(row)];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RowData
    : null;
}

export function getCellData(sheet: SheetData, row: number, column: number): CellData | null {
  assertIndex(row, 'row');
  assertIndex(column, 'column');
  const value = rowAt(sheet, row)?.cells?.[String(column)];
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as CellData
    : null;
}

export function updateCellData(
  sheet: SheetData,
  row: number,
  column: number,
  updater: (cell: CellData) => CellData | null,
): SheetData {
  assertIndex(row, 'row');
  assertIndex(column, 'column');
  const next = cloneSheet(sheet);
  const rows = { ...(next.rows ?? { len: 100 }) } as Record<string, unknown>;
  const currentRow = rowAt(next, row) ?? {};
  const mutableRow = { ...currentRow } as Record<string, unknown>;
  const cells = { ...(currentRow.cells ?? {}) } as Record<string, unknown>;
  const currentCell = getCellData(next, row, column) ?? {};
  const updated = updater(currentCell);

  if (updated === null) delete cells[String(column)];
  else cells[String(column)] = updated;
  mutableRow.cells = cells as CellsData;
  rows[String(row)] = mutableRow as RowData;
  return { ...next, rows: rows as RowsData } as unknown as SheetData;
}

export function setCellText(
  sheet: SheetData,
  row: number,
  column: number,
  text: string,
): SheetData {
  const current = getCellData(sheet, row, column);
  if (current?.editable === false || current?.text === text) return sheet;
  return updateCellData(sheet, row, column, cell => {
    const mutable = { ...cell } as Record<string, unknown>;
    mutable.text = text;
    delete mutable.value;
    return mutable as CellData;
  });
}

export function setCellStyleIndex(
  sheet: SheetData,
  row: number,
  column: number,
  style: number | null,
): SheetData {
  if (style !== null && (!Number.isSafeInteger(style) || style < 0)) {
    throw new RangeError('style index must be a non-negative safe integer');
  }
  const current = getCellData(sheet, row, column);
  if ((current?.style ?? null) === style) return sheet;
  return updateCellData(sheet, row, column, cell => {
    const mutable = { ...cell } as Record<string, unknown>;
    if (style === null) delete mutable.style;
    else mutable.style = style;
    return mutable as CellData;
  });
}

export function setCellMergeSpan(
  sheet: SheetData,
  row: number,
  column: number,
  span: readonly [number, number] | null,
): SheetData {
  return updateCellData(sheet, row, column, cell => {
    const mutable = { ...cell } as Record<string, unknown>;
    if (span === null || (span[0] === 0 && span[1] === 0)) delete mutable.merge;
    else mutable.merge = [...span];
    return mutable as CellData;
  });
}
