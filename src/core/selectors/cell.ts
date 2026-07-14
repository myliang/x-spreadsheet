import { serializeWorkbook } from '../serialization/serialize-workbook';
import type { CellData, SheetData } from '../types/workbook';
import { getCellData } from '../model/cells';

export function selectCell(sheet: SheetData, row: number, column: number): CellData | null {
  const clone = serializeWorkbook([sheet])[0] as SheetData;
  return getCellData(clone, row, column);
}

export function selectCellText(sheet: SheetData, row: number, column: number): string {
  return getCellData(sheet, row, column)?.text ?? '';
}
