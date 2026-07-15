import type { CellAddress, Selection, SheetId } from '../types/coordinates';
import type { BorderMode } from '../types/options';
import type { BorderLine, CellStyle } from '../types/workbook';
import type { FilterDefinition } from '../types/options';
import type { ValidationRule } from '../types/validation';
import type { PasteMode } from '../operations/clipboard';

export interface SetCellTextCommand {
  readonly type: 'set-cell-text';
  readonly address: CellAddress;
  readonly text: string;
}

export interface SetStyleCommand {
  readonly type: 'set-style';
  readonly selection: Selection;
  readonly patch: Readonly<Partial<CellStyle>>;
}

export interface SetBorderCommand {
  readonly type: 'set-border';
  readonly selection: Selection;
  readonly mode: BorderMode;
  readonly line?: BorderLine;
}

export interface ClearFormatCommand {
  readonly type: 'clear-format';
  readonly selection: Selection;
}

export interface PaintFormatCommand {
  readonly type: 'paint-format';
  readonly source: Selection;
  readonly target: Selection;
}

export interface IndexedSheetCommand {
  readonly type: 'insert-row' | 'delete-row' | 'insert-column' | 'delete-column';
  readonly sheet: SheetId;
  readonly index: number;
  readonly count?: number;
}

export interface ResizeRowCommand {
  readonly type: 'set-row-height';
  readonly sheet: SheetId;
  readonly row: number;
  readonly height: number;
  readonly count?: number;
}

export interface HideRowCommand {
  readonly type: 'set-row-hidden';
  readonly sheet: SheetId;
  readonly row: number;
  readonly hidden: boolean;
  readonly count?: number;
}

export interface ResizeColumnCommand {
  readonly type: 'set-column-width';
  readonly sheet: SheetId;
  readonly column: number;
  readonly width: number;
  readonly count?: number;
}

export interface HideColumnCommand {
  readonly type: 'set-column-hidden';
  readonly sheet: SheetId;
  readonly column: number;
  readonly hidden: boolean;
  readonly count?: number;
}

export interface MergeCommand {
  readonly type: 'merge' | 'unmerge';
  readonly selection: Selection;
}

export interface SetFreezeCommand {
  readonly type: 'set-freeze';
  readonly sheet: SheetId;
  readonly row: number;
  readonly column: number;
}

export interface AddSheetCommand {
  readonly type: 'add-sheet';
  readonly name?: string;
}

export interface DeleteSheetCommand {
  readonly type: 'delete-sheet';
  readonly sheet: SheetId;
}

export interface RenameSheetCommand {
  readonly type: 'rename-sheet';
  readonly sheet: SheetId;
  readonly name: string;
}

export interface PasteInternalCommand {
  readonly type: 'paste-internal';
  readonly source: Selection;
  readonly target: Selection;
  readonly mode: PasteMode;
  readonly cut: boolean;
}

export interface PasteExternalCommand {
  readonly type: 'paste-external';
  readonly target: Selection;
  readonly values: readonly (readonly string[])[];
}

export interface AutofillCommand {
  readonly type: 'autofill';
  readonly source: Selection;
  readonly target: Selection;
  readonly mode: PasteMode;
}

export interface SetFilterCommand {
  readonly type: 'set-filter';
  readonly selection: Selection;
  readonly filter: FilterDefinition;
}

export interface ClearFilterCommand {
  readonly type: 'clear-filter';
  readonly sheet: SheetId;
}

export interface SortCommand {
  readonly type: 'sort';
  readonly sheet: SheetId;
  readonly column: number;
  readonly order: 'asc' | 'desc';
}

export interface SetValidationCommand {
  readonly type: 'set-validation';
  readonly selection: Selection;
  readonly rule: ValidationRule;
}

export interface RemoveValidationCommand {
  readonly type: 'remove-validation';
  readonly selection: Selection;
}

export interface UndoCommand {
  readonly type: 'undo';
}

export interface RedoCommand {
  readonly type: 'redo';
}

export type HistoryCommand = UndoCommand | RedoCommand;

/**
 * The closed document command contract. Task-specific operation modules handle
 * each variant; adding a variant here without an apply branch must fail rather
 * than report a successful mutation.
 */
export type WorkbookCommand =
  | SetCellTextCommand
  | SetStyleCommand
  | SetBorderCommand
  | ClearFormatCommand
  | PaintFormatCommand
  | IndexedSheetCommand
  | ResizeRowCommand
  | HideRowCommand
  | ResizeColumnCommand
  | HideColumnCommand
  | MergeCommand
  | SetFreezeCommand
  | AddSheetCommand
  | DeleteSheetCommand
  | RenameSheetCommand
  | PasteInternalCommand
  | PasteExternalCommand
  | AutofillCommand
  | SetFilterCommand
  | ClearFilterCommand
  | SortCommand
  | SetValidationCommand
  | RemoveValidationCommand
  | UndoCommand
  | RedoCommand;

export type CommandResult<Command extends WorkbookCommand> =
  Command extends AddSheetCommand ? SheetId : void;
