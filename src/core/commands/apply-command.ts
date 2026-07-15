import { selectCellText } from '../selectors/cell';
import type { WorkbookState } from '../model/workbook-state';
import { applyCellOperation } from '../operations/cell';
import { applyMergeOperation } from '../operations/merge';
import { applyFreezeOperation, applySheetOperation } from '../operations/sheet';
import { applyStructureOperation, structureRange } from '../operations/structure';
import { applyStyleOperation } from '../operations/style';
import { paintFormatTargetRange } from '../operations/style';
import type { CellRange, SheetId } from '../types/coordinates';
import type { WorkbookChangeKind } from '../types/changes';
import { invalidCommand } from './validate-command';
import type { WorkbookCommand } from './workbook-command';
import { pasteExternal, pasteInternal } from '../operations/clipboard';
import { autofillRange } from '../operations/autofill';
import { clearFilter, setFilter } from '../operations/filter';
import { setSort } from '../operations/sort';
import { removeValidation, setValidation } from '../operations/validation';
import { parseA1Range } from '../coordinates/ranges';

export interface AppliedCommand {
  readonly state: WorkbookState;
  readonly result: unknown;
  readonly kind: WorkbookChangeKind;
  readonly sheet: SheetId;
  readonly range?: CellRange;
  readonly undoable: boolean;
}

export interface ApplyCommandOptions {
  readonly capturePasteValues?: boolean;
}

function commandType(command: unknown): string {
  if (command !== null && typeof command === 'object' && 'type' in command) {
    return String(command.type);
  }
  return '<unknown>';
}

function assertNeverCommand(command: never): never {
  throw invalidCommand(`Unknown workbook command: ${commandType(command)}`);
}

function failure(command: unknown, cause: unknown): never {
  if (cause instanceof Error && 'code' in cause && cause.code === 'INVALID_COMMAND') throw cause;
  const message = cause instanceof Error ? cause.message : String(cause);
  throw invalidCommand(`${commandType(command)} could not be applied: ${message}`, cause);
}

export function applyCommand(
  state: WorkbookState,
  command: Exclude<WorkbookCommand, { readonly type: 'undo' | 'redo' }>,
  options: ApplyCommandOptions = {},
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
      case 'set-border':
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
        const range = paintFormatTargetRange(command);
        const next = applyStyleOperation(target.data, command, source.data);
        if (next === target.data) return null;
        return {
          state: state.update(command.target.sheet, () => next),
          result: undefined,
          kind: 'style',
          sheet: command.target.sheet,
          range,
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
      case 'paste-internal': {
        const source = state.get(command.source.sheet);
        const target = state.get(command.target.sheet);
        if (source === null || target === null) throw new RangeError('Unknown clipboard sheet ID');
        const transformed = pasteInternal(
          target.data,
          source.data,
          command.source.range,
          command.target.range,
          command.mode,
          command.cut,
          options.capturePasteValues !== false,
        );
        if (transformed.sheet === target.data) return null;
        return {
          state: state.update(command.target.sheet, () => transformed.sheet),
          result: transformed.values,
          kind: 'clipboard',
          sheet: command.target.sheet,
          range: transformed.range,
          undoable: true,
        };
      }
      case 'paste-external': {
        const target = state.get(command.target.sheet);
        if (target === null) throw new RangeError(`Unknown sheet ID: ${command.target.sheet}`);
        const transformed = pasteExternal(
          target.data,
          command.target.range,
          command.values,
          options.capturePasteValues !== false,
        );
        if (transformed.sheet === target.data) return null;
        return {
          state: state.update(command.target.sheet, () => transformed.sheet),
          result: transformed.values,
          kind: 'clipboard',
          sheet: command.target.sheet,
          range: transformed.range,
          undoable: true,
        };
      }
      case 'autofill': {
        const runtimeSheet = state.get(command.target.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.target.sheet}`);
        const transformed = autofillRange(
          runtimeSheet.data,
          command.source.range,
          command.target.range,
          command.mode,
        );
        if (transformed.sheet === runtimeSheet.data) return null;
        return {
          state: state.update(command.target.sheet, () => transformed.sheet),
          result: undefined,
          kind: 'autofill',
          sheet: command.target.sheet,
          range: transformed.range,
          undoable: true,
        };
      }
      case 'set-filter': {
        const runtimeSheet = state.get(command.selection.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.selection.sheet}`);
        const next = setFilter(runtimeSheet.data, command.selection.range, command.filter);
        if (next === runtimeSheet.data) return null;
        return {
          state: state.update(command.selection.sheet, () => next),
          result: undefined,
          kind: 'filter',
          sheet: command.selection.sheet,
          range: command.selection.range,
          undoable: true,
        };
      }
      case 'clear-filter': {
        const runtimeSheet = state.get(command.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.sheet}`);
        const range = runtimeSheet.data.autofilter?.ref === undefined
          ? undefined
          : parseA1Range(runtimeSheet.data.autofilter.ref);
        const next = clearFilter(runtimeSheet.data);
        if (next === runtimeSheet.data) return null;
        return {
          state: state.update(command.sheet, () => next),
          result: undefined,
          kind: 'filter',
          sheet: command.sheet,
          ...(range === undefined ? {} : { range }),
          undoable: true,
        };
      }
      case 'sort': {
        const runtimeSheet = state.get(command.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.sheet}`);
        const range = parseA1Range(runtimeSheet.data.autofilter!.ref!);
        const next = setSort(runtimeSheet.data, command.column, command.order);
        if (next === runtimeSheet.data) return null;
        return {
          state: state.update(command.sheet, () => next),
          result: undefined,
          kind: 'filter',
          sheet: command.sheet,
          range,
          undoable: true,
        };
      }
      case 'set-validation':
      case 'remove-validation': {
        const runtimeSheet = state.get(command.selection.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.selection.sheet}`);
        const next = command.type === 'set-validation'
          ? setValidation(runtimeSheet.data, command.selection.range, command.rule)
          : removeValidation(runtimeSheet.data, command.selection.range);
        if (next === runtimeSheet.data) return null;
        return {
          state: state.update(command.selection.sheet, () => next),
          result: undefined,
          kind: 'validation',
          sheet: command.selection.sheet,
          range: command.selection.range,
          undoable: true,
        };
      }
      default:
        return assertNeverCommand(command);
    }
  } catch (cause) {
    return failure(command, cause);
  }
}
