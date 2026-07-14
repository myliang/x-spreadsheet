import { containsCell } from '../coordinates/ranges';
import { canonicalSparseIndex, getCellData } from '../model/cells';
import type { CellRange } from '../types/coordinates';
import type { CellData, RowData, SheetData } from '../types/workbook';

function lockedCells(
  sheet: SheetData,
): readonly { readonly row: bigint; readonly column: bigint; readonly cell: CellData }[] {
  const output: { row: bigint; column: bigint; cell: CellData }[] = [];
  for (const [rowKey, rowValue] of Object.entries(sheet.rows ?? {})) {
    const row = canonicalSparseIndex(rowKey);
    if (row === null || rowValue === null || typeof rowValue !== 'object' || Array.isArray(rowValue)) {
      continue;
    }
    for (const [columnKey, cellValue] of Object.entries((rowValue as RowData).cells ?? {})) {
      const column = canonicalSparseIndex(columnKey);
      if (column === null || cellValue === null
        || typeof cellValue !== 'object' || Array.isArray(cellValue)) continue;
      const cell = cellValue as CellData;
      if (cell.editable === false) output.push({ row, column, cell });
    }
  }
  return output;
}

function locked(message: string): never {
  throw new RangeError(message);
}

export function assertCellEditable(sheet: SheetData, row: number, column: number): void {
  if (getCellData(sheet, row, column)?.editable === false) {
    locked(`cell ${row},${column} is not editable`);
  }
}

export function assertRangeEditable(sheet: SheetData, range: CellRange): void {
  for (const entry of lockedCells(sheet)) {
    if (entry.row <= BigInt(Number.MAX_SAFE_INTEGER)
      && entry.column <= BigInt(Number.MAX_SAFE_INTEGER)
      && containsCell(range, { row: Number(entry.row), column: Number(entry.column) })) {
      locked(`range contains locked cell ${entry.row},${entry.column}`);
    }
  }
}

export function assertMergeEditable(sheet: SheetData, range: CellRange): void {
  for (const entry of lockedCells(sheet)) {
    const isAnchor = entry.row === BigInt(range.start.row)
      && entry.column === BigInt(range.start.column);
    if (!isAnchor && entry.row <= BigInt(Number.MAX_SAFE_INTEGER)
      && entry.column <= BigInt(Number.MAX_SAFE_INTEGER)
      && containsCell(range, { row: Number(entry.row), column: Number(entry.column) })) {
      locked(`merge would delete locked cell ${entry.row},${entry.column}`);
    }
  }
}
