import { addMerge, removeMerge } from '../model/merges';
import type { MergeCommand } from '../commands/workbook-command';
import type { SheetData } from '../types/workbook';

export function applyMergeOperation(sheet: SheetData, command: MergeCommand): SheetData {
  return command.type === 'merge'
    ? addMerge(sheet, command.selection.range)
    : removeMerge(sheet, command.selection.range);
}
