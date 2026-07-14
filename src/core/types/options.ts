import type { Selection, SheetId } from './coordinates';
import type { CellStyle } from './workbook';
import type { ValidationRule } from './validation';

export interface SheetRowOptions {
  readonly initialCount?: number;
  readonly defaultHeight?: number;
}

export interface SheetColumnOptions {
  readonly initialCount?: number;
  readonly defaultWidth?: number;
  readonly minimumWidth?: number;
}

export interface SheetOptions {
  readonly showGrid?: boolean;
  readonly showContextMenu?: boolean;
  readonly rows?: SheetRowOptions;
  readonly columns?: SheetColumnOptions;
  readonly rowHeaderWidth?: number;
  readonly defaultStyle?: CellStyle;
  readonly autoFocus?: boolean;
}

export interface FilterDefinition {
  readonly column: number;
  readonly operator: 'all' | 'in';
  readonly value: readonly string[];
}

export type ToolbarAction =
  | { readonly type: 'undo' | 'redo' | 'print' }
  | { readonly type: 'paint-format' | 'clear-format' }
  | { readonly type: 'set-style'; readonly patch: Readonly<Partial<CellStyle>> }
  | { readonly type: 'merge' | 'unmerge' }
  | { readonly type: 'freeze' | 'unfreeze' }
  | { readonly type: 'insert-row' | 'delete-row' | 'hide-row' | 'unhide-row' }
  | {
    readonly type: 'insert-column' | 'delete-column' | 'hide-column' | 'unhide-column';
  }
  | { readonly type: 'set-validation'; readonly rule: ValidationRule }
  | { readonly type: 'remove-validation' }
  | { readonly type: 'set-filter'; readonly filter: FilterDefinition }
  | { readonly type: 'clear-filter' }
  | { readonly type: 'sort'; readonly order: 'asc' | 'desc' };

export interface ToolbarRenderProps {
  readonly selection: Selection | null;
  readonly activeStyle: CellStyle;
  readonly readOnly: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly merged: boolean;
  readonly frozen: boolean;
  readonly disabledActions: ReadonlySet<ToolbarAction['type']>;
  readonly execute: (action: ToolbarAction) => void;
}

export interface SheetTabItem {
  readonly id: SheetId;
  readonly index: number;
  readonly name: string;
}

export interface SheetTabsRenderProps {
  readonly sheets: readonly SheetTabItem[];
  readonly activeSheet: SheetId | null;
  readonly readOnly: boolean;
  readonly add: (name?: string) => void;
  readonly delete: (sheet: SheetId) => void;
  readonly rename: (sheet: SheetId, name: string) => void;
  readonly activate: (sheet: SheetId) => void;
}
