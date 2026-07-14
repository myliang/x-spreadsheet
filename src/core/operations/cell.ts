import { setCellText } from '../model/cells';
import type { SheetData } from '../types/workbook';
import type { SetCellTextCommand } from '../commands/workbook-command';

export function applyCellOperation(
  sheet: SheetData,
  command: SetCellTextCommand,
): SheetData {
  return setCellText(sheet, command.address.row, command.address.column, command.text);
}
