import { TegoSheetException } from '../errors/tego-sheet-exception';
import type { WorkbookState } from '../model/workbook-state';
import { containsCell } from '../coordinates/ranges';
import { assertStructureCommand, columnCount, rowCount } from '../operations/structure';
import { assertSheetName } from '../operations/sheet';
import {
  assertStyleResourceLimit,
  paintFormatTargetRange,
} from '../operations/style';
import {
  assertCellEditable,
  assertMergeEditable,
  assertRangeEditable,
} from '../operations/editable';
import { parseWorkbook } from '../serialization/parse-workbook';
import { assertCellAddress, assertCellPoint, assertCellRange } from '../types/coordinates';
import type { Selection, SheetId } from '../types/coordinates';
import type { BorderLine, CellStyle } from '../types/workbook';
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

function validateSelection(
  state: WorkbookState,
  selection: unknown,
): asserts selection is Selection {
  try {
    if (selection === null || typeof selection !== 'object' || Array.isArray(selection)) {
      throw new TypeError('selection must be an object');
    }
    const value = selection as Record<string, unknown>;
    if (typeof value.sheet !== 'string' || value.sheet.trim().length === 0) {
      throw new TypeError('selection sheet must be a non-empty string');
    }
    const sheet = value.sheet as SheetId;
    validateSheet(state, sheet);
    assertCellRange(value.range);
    const runtimeSheet = state.get(sheet);
    if (runtimeSheet === null) throw new TypeError('selection sheet does not exist');
    if (value.range.end.row >= rowCount(runtimeSheet.data)
      || value.range.end.column >= columnCount(runtimeSheet.data)) {
      throw new TypeError('selection range exceeds the sheet structure');
    }
    assertCellPoint(value.active);
    if (!containsCell(value.range, value.active)) {
      throw new TypeError('active cell must be within selection range');
    }
  } catch (cause) {
    throw invalidCommand('Command selection must contain a valid normalized range', cause);
  }
}

function assertNeverCommand(command: never): never {
  const runtime = command as { readonly type?: unknown };
  throw invalidCommand(`Unknown workbook command: ${String(runtime.type ?? '<missing>')}`);
}

function validCommandObject(command: unknown): command is WorkbookCommand {
  return command !== null && typeof command === 'object' && typeof (command as { type?: unknown }).type === 'string';
}

function validateStyleRange(state: WorkbookState, sheet: SheetId, range: {
  readonly start: { readonly row: number; readonly column: number };
  readonly end: { readonly row: number; readonly column: number };
}): void {
  const runtimeSheet = state.get(sheet);
  if (runtimeSheet === null) throw invalidCommand(`Unknown sheet ID: ${sheet}`);
  if (range.end.row >= rowCount(runtimeSheet.data)
    || range.end.column >= columnCount(runtimeSheet.data)) {
    throw invalidCommand('format range exceeds the sheet structure');
  }
  try {
    assertStyleResourceLimit(range);
    assertRangeEditable(runtimeSheet.data, range);
  } catch (cause) {
    throw invalidCommand('format range is not mutable', cause);
  }
}

function validateBorderLine(line: BorderLine | undefined): void {
  if (line === undefined) throw invalidCommand('Border mode requires a border line');
  try {
    parseWorkbook({ styles: [{ border: { top: line } } as unknown as CellStyle] });
  } catch (cause) {
    throw invalidCommand('Border line is invalid', cause);
  }
}

export function validateCommand(state: WorkbookState, command: WorkbookCommand): void {
  if (!validCommandObject(command)) throw invalidCommand('Command must have a string type');
  switch (command.type) {
    case 'set-cell-text':
      try {
        assertCellAddress(command.address);
      } catch (cause) {
        throw invalidCommand('set-cell-text requires a valid cell address', cause);
      }
      validateSheet(state, command.address.sheet);
      if (typeof command.text !== 'string') throw invalidCommand('Cell text must be a string');
      try {
        assertCellEditable(
          state.get(command.address.sheet)!.data,
          command.address.row,
          command.address.column,
        );
      } catch (cause) {
        throw invalidCommand('Cell is not editable', cause);
      }
      return;
    case 'set-style':
      validateSelection(state, command.selection);
      if (command.patch === null || typeof command.patch !== 'object' || Array.isArray(command.patch)) {
        throw invalidCommand('Style patch must be an object');
      }
      try {
        parseWorkbook({ styles: [command.patch as CellStyle] });
      } catch (cause) {
        throw invalidCommand('Style patch must contain valid style values', cause);
      }
      validateStyleRange(state, command.selection.sheet, command.selection.range);
      return;
    case 'set-border':
      validateSelection(state, command.selection);
      if (![
        'none', 'all', 'inside', 'outside', 'horizontal', 'vertical',
        'top', 'bottom', 'left', 'right',
      ].includes(command.mode)) {
        throw invalidCommand('Border mode is invalid');
      }
      if (command.mode !== 'none') validateBorderLine(command.line);
      validateStyleRange(state, command.selection.sheet, command.selection.range);
      return;
    case 'clear-format':
      validateSelection(state, command.selection);
      validateStyleRange(state, command.selection.sheet, command.selection.range);
      return;
    case 'paint-format':
      validateSelection(state, command.source);
      validateSelection(state, command.target);
      try {
        const target = paintFormatTargetRange(command);
        validateStyleRange(state, command.target.sheet, target);
      } catch (cause) {
        if (cause instanceof TegoSheetException) throw cause;
        throw invalidCommand('Paint format target is invalid', cause);
      }
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
      validateSelection(state, command.selection);
      try {
        assertMergeEditable(state.get(command.selection.sheet)!.data, command.selection.range);
      } catch (cause) {
        throw invalidCommand('Merge would delete locked cells', cause);
      }
      return;
    case 'unmerge':
      validateSelection(state, command.selection);
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
    default:
      return assertNeverCommand(command);
  }
}
