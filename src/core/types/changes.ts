import type {
  CellAddress,
  CellRange,
  Selection,
  SheetId,
} from './coordinates';

export type WorkbookChangeKind =
  | 'cell'
  | 'style'
  | 'structure'
  | 'merge'
  | 'clipboard'
  | 'autofill'
  | 'filter'
  | 'validation'
  | 'sheet'
  | 'history';

export type ChangeSource =
  | 'keyboard'
  | 'pointer'
  | 'touch'
  | 'toolbar'
  | 'sheet-tabs'
  | 'context-menu'
  | 'clipboard'
  | 'ref';

export interface WorkbookChange {
  readonly id: string;
  readonly kind: WorkbookChangeKind;
  readonly source: ChangeSource;
  readonly sheet: SheetId;
  readonly range?: CellRange;
}

export interface CellEditEvent {
  readonly changeId: string;
  readonly address: CellAddress;
  readonly previousText: string;
  readonly text: string;
  readonly source: ChangeSource;
}

export interface PasteEvent {
  readonly changeId: string;
  readonly source: 'internal' | 'external';
  readonly sourceSelection?: Selection;
  readonly target: Selection;
  readonly values: readonly (readonly string[])[];
}

export interface ActiveSheetChangeEvent {
  readonly sheet: SheetId;
  readonly index: number;
  readonly source: 'sheet-tabs' | 'keyboard' | 'ref';
}

export interface LocaleMessages {
  readonly [key: string]: string | LocaleMessages;
}

export interface LocaleDefinition {
  readonly id: string;
  readonly messages: LocaleMessages;
}
