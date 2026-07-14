import { renderA1 } from '../coordinates/a1';
import type { WorkbookState } from '../model/workbook-state';
import type {
  AddSheetCommand,
  DeleteSheetCommand,
  RenameSheetCommand,
  SetFreezeCommand,
} from '../commands/workbook-command';
import type { SheetId } from '../types/coordinates';
import type { SheetData } from '../types/workbook';

export type SheetCommand = AddSheetCommand | DeleteSheetCommand | RenameSheetCommand;

function names(state: WorkbookState): readonly string[] {
  return state.sheets.map(sheet => sheet.data.name ?? '');
}

export function nextSheetName(state: WorkbookState): string {
  const used = new Set(names(state));
  let index = state.sheets.length + 1;
  while (used.has(`sheet${index}`)) index += 1;
  return `sheet${index}`;
}

export function assertSheetName(
  state: WorkbookState,
  value: string,
  current?: SheetId,
): void {
  if (value.trim().length === 0) throw new RangeError('sheet name must not be blank');
  if (state.sheets.some(sheet => sheet.id !== current && sheet.data.name === value)) {
    throw new RangeError(`sheet name already exists: ${value}`);
  }
}

export function applySheetOperation(
  state: WorkbookState,
  command: SheetCommand,
): { readonly state: WorkbookState; readonly sheet: SheetId; readonly result: SheetId | undefined } {
  switch (command.type) {
    case 'add-sheet': {
      const name = command.name ?? nextSheetName(state);
      assertSheetName(state, name);
      const next = state.add(name);
      const sheet = next.sheets[next.sheets.length - 1]!.id;
      return { state: next, sheet, result: sheet };
    }
    case 'delete-sheet':
      return { state: state.delete(command.sheet), sheet: command.sheet, result: undefined };
    case 'rename-sheet':
      assertSheetName(state, command.name, command.sheet);
      return {
        state: state.rename(command.sheet, command.name),
        sheet: command.sheet,
        result: undefined,
      };
  }
}

export function applyFreezeOperation(state: WorkbookState, command: SetFreezeCommand): WorkbookState {
  const freeze = renderA1({ row: command.row, column: command.column });
  const current = state.get(command.sheet);
  if (current === null) throw new RangeError(`Unknown sheet ID: ${command.sheet}`);
  if (current.data.freeze === freeze) return state;
  return state.update(command.sheet, sheet => (
    { ...sheet, freeze } as unknown as SheetData
  ));
}
