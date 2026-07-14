import { setCellText } from '../model/cells';
import type { SheetData } from '../types/workbook';
import type { SetCellTextCommand } from '../commands/workbook-command';
import { assertCellEditable } from './editable';

export function applyCellOperation(
  sheet: SheetData,
  command: SetCellTextCommand,
): SheetData {
  assertCellEditable(sheet, command.address.row, command.address.column);
  return setCellText(sheet, command.address.row, command.address.column, command.text);
}
