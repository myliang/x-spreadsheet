import { shiftFormulaReferences } from '../coordinates/a1';
import { rangeSize } from '../coordinates/ranges';
import { cloneSheet, getCellData } from '../model/cells';
import type { CellPoint, CellRange } from '../types/coordinates';
import type { CellData, SheetData } from '../types/workbook';
import { pasteInternal, type PasteMode, type PasteTransform } from './clipboard';
import { semanticEqual } from '../serialization/semantic-equal';

const NUMERIC_SUFFIX = /(-?(?:\d+(?:\.\d*)?|\.\d+))$/;

export function autofillText(
  text: string,
  step: number,
  delta: CellPoint,
): string {
  if (text.startsWith('=')) return shiftFormulaReferences(text, delta);
  const match = NUMERIC_SUFFIX.exec(text);
  if (match === null) return text;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) return text;
  return `${text.slice(0, match.index)}${numeric + step}`;
}

function fillStep(source: CellRange, target: CellRange, row: number, column: number): number {
  const [sourceRows, sourceColumns] = rangeSize(source);
  if (target.start.row > source.end.row) {
    return Math.floor((row - target.start.row) / sourceRows) + 1;
  }
  if (target.end.row < source.start.row) {
    return -(Math.floor((target.end.row - row) / sourceRows) + 1);
  }
  if (target.start.column > source.end.column) {
    return Math.floor((column - target.start.column) / sourceColumns) + 1;
  }
  if (target.end.column < source.start.column) {
    return -(Math.floor((target.end.column - column) / sourceColumns) + 1);
  }
  return 0;
}

function mutableCell(sheet: SheetData, row: number, column: number): Record<string, unknown> {
  const mutable = sheet as Record<string, unknown>;
  const rows = mutable.rows as Record<string, unknown>;
  let rowValue = rows[String(row)];
  if (rowValue === null || typeof rowValue !== 'object' || Array.isArray(rowValue)) {
    rowValue = {};
    rows[String(row)] = rowValue;
  }
  const record = rowValue as Record<string, unknown>;
  let cells = record.cells;
  if (cells === null || typeof cells !== 'object' || Array.isArray(cells)) {
    cells = {};
    record.cells = cells;
  }
  const values = cells as Record<string, unknown>;
  let cell = values[String(column)];
  if (cell === null || typeof cell !== 'object' || Array.isArray(cell)) {
    cell = {};
    values[String(column)] = cell;
  }
  return cell as Record<string, unknown>;
}

export function autofillRange(
  sheet: SheetData,
  source: CellRange,
  target: CellRange,
  mode: PasteMode = 'all',
): PasteTransform {
  const pasted = pasteInternal(sheet, sheet, source, target, mode, false);
  if (mode === 'format') return pasted;
  const [sourceRows, sourceColumns] = rangeSize(source);
  const next = cloneSheet(pasted.sheet);
  for (let row = pasted.range.start.row; row <= pasted.range.end.row; row += 1) {
    for (let column = pasted.range.start.column; column <= pasted.range.end.column; column += 1) {
      const sourceRow = source.start.row + ((row - pasted.range.start.row) % sourceRows);
      const sourceColumn = source.start.column + ((column - pasted.range.start.column) % sourceColumns);
      const sourceCell: CellData | null = getCellData(sheet, sourceRow, sourceColumn);
      if (sourceCell?.text === undefined || sourceCell.text.length === 0) continue;
      const cell = mutableCell(next, row, column);
      cell.text = autofillText(sourceCell.text, fillStep(source, target, row, column), {
        row: row - sourceRow,
        column: column - sourceColumn,
      });
      delete cell.value;
    }
  }
  return {
    sheet: semanticEqual(next, sheet) ? sheet : next,
    range: pasted.range,
    values: Array.from(
      { length: pasted.range.end.row - pasted.range.start.row + 1 },
      (_, rowOffset) => Array.from(
        { length: pasted.range.end.column - pasted.range.start.column + 1 },
        (_, columnOffset) => getCellData(
          next,
          pasted.range.start.row + rowOffset,
          pasted.range.start.column + columnOffset,
        )?.text ?? '',
      ),
    ),
  };
}
