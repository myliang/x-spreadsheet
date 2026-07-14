import { TegoSheetException } from '../errors/tego-sheet-exception';
import type { WorkbookState } from '../model/workbook-state';
import { assertCellAddress, assertCellRange } from '../types/coordinates';
import type { SheetId } from '../types/coordinates';
import type { WorkbookCommand } from './workbook-command';

export function invalidCommand(message: string, cause?: unknown): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_COMMAND',
    message,
    recoverable: true,
    ...(cause === undefined ? {} : { cause }),
  });
}

function validateSheet(state: WorkbookState, sheet: SheetId): void {
  if (state.get(sheet) === null) throw invalidCommand(`Unknown sheet ID: ${sheet}`);
}

function validateIndex(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw invalidCommand(`${label} must be a non-negative safe integer`);
  }
}

function validatePositiveCount(value: number | undefined): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
    throw invalidCommand('count must be a positive safe integer');
  }
}

function validateSelection(state: WorkbookState, selection: WorkbookCommand & {
  readonly selection: { readonly sheet: SheetId; readonly range: unknown };
}): void {
  validateSheet(state, selection.selection.sheet);
  try {
    assertCellRange(selection.selection.range);
  } catch (cause) {
    throw invalidCommand('Command selection must contain a valid normalized range', cause);
  }
}

export function validateCommand(state: WorkbookState, command: WorkbookCommand): void {
  switch (command.type) {
    case 'set-cell-text':
      try {
        assertCellAddress(command.address);
      } catch (cause) {
        throw invalidCommand('set-cell-text requires a valid cell address', cause);
      }
      validateSheet(state, command.address.sheet);
      if (typeof command.text !== 'string') throw invalidCommand('Cell text must be a string');
      return;
    case 'set-style':
      validateSelection(state, command);
      if (command.patch === null || typeof command.patch !== 'object' || Array.isArray(command.patch)) {
        throw invalidCommand('Style patch must be an object');
      }
      return;
    case 'clear-format':
      validateSelection(state, command);
      return;
    case 'paint-format':
      validateSelection(state, { ...command, selection: command.source });
      validateSelection(state, { ...command, selection: command.target });
      return;
    case 'insert-row':
    case 'delete-row':
    case 'insert-column':
    case 'delete-column':
      validateSheet(state, command.sheet);
      validateIndex(command.index, 'index');
      validatePositiveCount(command.count);
      return;
    case 'set-row-height':
      validateSheet(state, command.sheet);
      validateIndex(command.row, 'row');
      if (!Number.isFinite(command.height) || command.height < 0) {
        throw invalidCommand('height must be a non-negative finite number');
      }
      return;
    case 'set-row-hidden':
      validateSheet(state, command.sheet);
      validateIndex(command.row, 'row');
      if (typeof command.hidden !== 'boolean') throw invalidCommand('hidden must be a boolean');
      return;
    case 'set-column-width':
      validateSheet(state, command.sheet);
      validateIndex(command.column, 'column');
      if (!Number.isFinite(command.width) || command.width < 0) {
        throw invalidCommand('width must be a non-negative finite number');
      }
      return;
    case 'set-column-hidden':
      validateSheet(state, command.sheet);
      validateIndex(command.column, 'column');
      if (typeof command.hidden !== 'boolean') throw invalidCommand('hidden must be a boolean');
      return;
    case 'merge':
    case 'unmerge':
      validateSelection(state, command);
      return;
    case 'set-freeze':
      validateSheet(state, command.sheet);
      validateIndex(command.row, 'row');
      validateIndex(command.column, 'column');
      return;
    case 'add-sheet':
      if (command.name !== undefined && typeof command.name !== 'string') {
        throw invalidCommand('Sheet name must be a string');
      }
      return;
    case 'delete-sheet':
      validateSheet(state, command.sheet);
      return;
    case 'rename-sheet':
      validateSheet(state, command.sheet);
      if (typeof command.name !== 'string') throw invalidCommand('Sheet name must be a string');
      return;
    case 'undo':
    case 'redo':
      return;
  }
}
