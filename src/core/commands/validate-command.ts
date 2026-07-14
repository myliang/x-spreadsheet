import { TegoSheetException } from '../errors/tego-sheet-exception';
import type { WorkbookState } from '../model/workbook-state';
import { containsCell } from '../coordinates/ranges';
import { assertStructureCommand, columnCount, rowCount } from '../operations/structure';
import { assertSheetName } from '../operations/sheet';
import { parseWorkbook } from '../serialization/parse-workbook';
import { assertCellAddress, assertCellPoint, assertCellRange } from '../types/coordinates';
import type { SheetId } from '../types/coordinates';
import type { CellStyle } from '../types/workbook';
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
  readonly selection: { readonly sheet: SheetId; readonly range: unknown; readonly active: unknown };
}): void {
  validateSheet(state, selection.selection.sheet);
  try {
    assertCellRange(selection.selection.range);
    const runtimeSheet = state.get(selection.selection.sheet);
    if (runtimeSheet === null) throw new TypeError('selection sheet does not exist');
    const range = selection.selection.range as {
      readonly end: { readonly row: number; readonly column: number };
    };
    if (range.end.row >= rowCount(runtimeSheet.data)
      || range.end.column >= columnCount(runtimeSheet.data)) {
      throw new TypeError('selection range exceeds the sheet structure');
    }
    assertCellPoint(selection.selection.active);
    if (!containsCell(selection.selection.range as never, selection.selection.active)) {
      throw new TypeError('active cell must be within selection range');
    }
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
      try {
        parseWorkbook({ styles: [command.patch as CellStyle] });
      } catch (cause) {
        throw invalidCommand('Style patch must contain valid style values', cause);
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
      try {
        const runtimeSheet = state.get(command.sheet);
        if (runtimeSheet === null) throw new RangeError(`Unknown sheet ID: ${command.sheet}`);
        assertStructureCommand(runtimeSheet.data, command);
      } catch (cause) {
        throw invalidCommand(`${command.type} is outside the sheet structure`, cause);
      }
      return;
    case 'set-row-height':
      validateSheet(state, command.sheet);
      validateIndex(command.row, 'row');
      if (!Number.isFinite(command.height) || command.height < 0) {
        throw invalidCommand('height must be a non-negative finite number');
      }
      try {
        assertStructureCommand(state.get(command.sheet)!.data, command);
      } catch (cause) {
        throw invalidCommand('row is outside the sheet structure', cause);
      }
      return;
    case 'set-row-hidden':
      validateSheet(state, command.sheet);
      validateIndex(command.row, 'row');
      if (typeof command.hidden !== 'boolean') throw invalidCommand('hidden must be a boolean');
      try {
        assertStructureCommand(state.get(command.sheet)!.data, command);
      } catch (cause) {
        throw invalidCommand('row is outside the sheet structure', cause);
      }
      return;
    case 'set-column-width':
      validateSheet(state, command.sheet);
      validateIndex(command.column, 'column');
      if (!Number.isFinite(command.width) || command.width < 0) {
        throw invalidCommand('width must be a non-negative finite number');
      }
      try {
        assertStructureCommand(state.get(command.sheet)!.data, command);
      } catch (cause) {
        throw invalidCommand('column is outside the sheet structure', cause);
      }
      return;
    case 'set-column-hidden':
      validateSheet(state, command.sheet);
      validateIndex(command.column, 'column');
      if (typeof command.hidden !== 'boolean') throw invalidCommand('hidden must be a boolean');
      try {
        assertStructureCommand(state.get(command.sheet)!.data, command);
      } catch (cause) {
        throw invalidCommand('column is outside the sheet structure', cause);
      }
      return;
    case 'merge':
    case 'unmerge':
      validateSelection(state, command);
      return;
    case 'set-freeze':
      validateSheet(state, command.sheet);
      validateIndex(command.row, 'row');
      validateIndex(command.column, 'column');
      {
        const sheet = state.get(command.sheet)!;
        if (command.row >= rowCount(sheet.data) || command.column >= columnCount(sheet.data)) {
          throw invalidCommand('freeze point exceeds the sheet structure');
        }
      }
      return;
    case 'add-sheet':
      if (command.name !== undefined && typeof command.name !== 'string') {
        throw invalidCommand('Sheet name must be a string');
      }
      if (command.name !== undefined) {
        try {
          assertSheetName(state, command.name);
        } catch (cause) {
          throw invalidCommand('Sheet name is invalid', cause);
        }
      }
      return;
    case 'delete-sheet':
      validateSheet(state, command.sheet);
      return;
    case 'rename-sheet':
      validateSheet(state, command.sheet);
      if (typeof command.name !== 'string') throw invalidCommand('Sheet name must be a string');
      try {
        assertSheetName(state, command.name, command.sheet);
      } catch (cause) {
        throw invalidCommand('Sheet name is invalid', cause);
      }
      return;
    case 'undo':
    case 'redo':
      return;
  }
}
