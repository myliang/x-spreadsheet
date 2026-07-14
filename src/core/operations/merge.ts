import { addMerge, removeMerge } from '../model/merges';
import type { MergeCommand } from '../commands/workbook-command';
import type { SheetData } from '../types/workbook';
import { assertMergeEditable } from './editable';

export function applyMergeOperation(sheet: SheetData, command: MergeCommand): SheetData {
  if (command.type === 'merge') assertMergeEditable(sheet, command.selection.range);
  return command.type === 'merge'
    ? addMerge(sheet, command.selection.range)
    : removeMerge(sheet, command.selection.range);
}
