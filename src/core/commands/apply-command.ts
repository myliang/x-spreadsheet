import { selectCellText } from '../selectors/cell';
import { setCellText } from '../model/cells';
import type { WorkbookState } from '../model/workbook-state';
import type { CellRange, SheetId } from '../types/coordinates';
import type { WorkbookChangeKind } from '../types/changes';
import { invalidCommand } from './validate-command';
import type { WorkbookCommand } from './workbook-command';

export interface AppliedCommand {
  readonly state: WorkbookState;
  readonly result: unknown;
  readonly kind: WorkbookChangeKind;
  readonly sheet: SheetId;
  readonly range?: CellRange;
  readonly undoable: boolean;
}

export function applyCommand(
  state: WorkbookState,
  command: Exclude<WorkbookCommand, { readonly type: 'undo' | 'redo' }>,
): AppliedCommand | null {
  switch (command.type) {
    case 'set-cell-text': {
      const runtimeSheet = state.get(command.address.sheet);
      if (runtimeSheet === null) throw invalidCommand(`Unknown sheet ID: ${command.address.sheet}`);
      const previousText = selectCellText(
        runtimeSheet.data,
        command.address.row,
        command.address.column,
      );
      if (previousText === command.text) return null;

      const next = setCellText(
        runtimeSheet.data,
        command.address.row,
        command.address.column,
        command.text,
      );
      if (next === runtimeSheet.data) return null;

      const point = { row: command.address.row, column: command.address.column };
      return {
        state: state.update(command.address.sheet, () => next),
        result: undefined,
        kind: 'cell',
        sheet: command.address.sheet,
        range: { start: point, end: point },
        undoable: true,
      };
    }
    default:
      throw invalidCommand(`Command ${command.type} is not implemented`);
  }
}
