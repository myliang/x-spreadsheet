import { selectCellText } from '../selectors/cell';
import type { WorkbookState } from '../model/workbook-state';
import { applyCellOperation } from '../operations/cell';
import { applyMergeOperation } from '../operations/merge';
import { applyFreezeOperation, applySheetOperation } from '../operations/sheet';
import { applyStructureOperation, structureRange } from '../operations/structure';
import { applyStyleOperation } from '../operations/style';
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

function failure(command: WorkbookCommand, cause: unknown): never {
  if (cause instanceof Error && 'code' in cause && cause.code === 'INVALID_COMMAND') throw cause;
  const message = cause instanceof Error ? cause.message : String(cause);
  throw invalidCommand(`${command.type} could not be applied: ${message}`, cause);
}

export function applyCommand(
  state: WorkbookState,
  command: Exclude<WorkbookCommand, { readonly type: 'undo' | 'redo' }>,
): AppliedCommand | null {
  try {
    switch (command.type) {
      case 'set-cell-text': {
        const runtimeSheet = state.get(command.address.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.address.sheet}`);
        const previousText = selectCellText(
          runtimeSheet.data,
          command.address.row,
          command.address.column,
        );
        if (previousText === command.text) return null;
        const next = applyCellOperation(runtimeSheet.data, command);
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
      case 'set-style':
      case 'clear-format': {
        const runtimeSheet = state.get(command.selection.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.selection.sheet}`);
        const next = applyStyleOperation(runtimeSheet.data, command);
        if (next === runtimeSheet.data) return null;
        return {
          state: state.update(command.selection.sheet, () => next),
          result: undefined,
          kind: 'style',
          sheet: command.selection.sheet,
          range: command.selection.range,
          undoable: true,
        };
      }
      case 'paint-format': {
        const source = state.get(command.source.sheet);
        const target = state.get(command.target.sheet);
        if (source === null || target === null) throw new RangeError('Unknown paint-format sheet ID');
        const next = applyStyleOperation(target.data, command, source.data);
        if (next === target.data) return null;
        return {
          state: state.update(command.target.sheet, () => next),
          result: undefined,
          kind: 'style',
          sheet: command.target.sheet,
          range: command.target.range,
          undoable: true,
        };
      }
      case 'insert-row':
      case 'delete-row':
      case 'insert-column':
      case 'delete-column':
      case 'set-row-height':
      case 'set-row-hidden':
      case 'set-column-width':
      case 'set-column-hidden': {
        const runtimeSheet = state.get(command.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.sheet}`);
        const range = structureRange(runtimeSheet.data, command);
        const next = applyStructureOperation(runtimeSheet.data, command);
        if (next === runtimeSheet.data) return null;
        return {
          state: state.update(command.sheet, () => next),
          result: undefined,
          kind: 'structure',
          sheet: command.sheet,
          range,
          undoable: true,
        };
      }
      case 'merge':
      case 'unmerge': {
        const runtimeSheet = state.get(command.selection.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.selection.sheet}`);
        const next = applyMergeOperation(runtimeSheet.data, command);
        if (next === runtimeSheet.data) return null;
        return {
          state: state.update(command.selection.sheet, () => next),
          result: undefined,
          kind: 'merge',
          sheet: command.selection.sheet,
          range: command.selection.range,
          undoable: true,
        };
      }
      case 'set-freeze': {
        const runtimeSheet = state.get(command.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.sheet}`);
        const next = applyFreezeOperation(state, command);
        if (next === state) return null;
        return {
          state: next,
          result: undefined,
          kind: 'structure',
          sheet: command.sheet,
          undoable: true,
        };
      }
      case 'add-sheet':
      case 'delete-sheet':
      case 'rename-sheet': {
        const applied = applySheetOperation(state, command);
        if (applied.state === state) return null;
        return {
          state: applied.state,
          result: applied.result,
          kind: 'sheet',
          sheet: applied.sheet,
          undoable: true,
        };
      }
    }
  } catch (cause) {
    return failure(command, cause);
  }
}
