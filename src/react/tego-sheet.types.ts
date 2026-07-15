import type { CSSProperties } from 'react';
import type {
  ActiveSheetChangeEvent,
  CellAddress,
  CellData,
  CellEditEvent,
  CellStyle,
  LocaleDefinition,
  PasteEvent,
  Selection,
  SheetId,
  SheetOptions,
  TegoSheetError,
  ValidationResult,
  WorkbookChange,
  WorkbookData,
  WorkbookInput,
} from '../core';
import type { SheetTabsRenderer, ToolbarRenderer } from '../ui/slot-types';

export type { SheetTabsRenderer, ToolbarRenderer } from '../ui/slot-types';

export interface TegoSheetCallbacks {
  readonly onChange?: (value: WorkbookData, change: WorkbookChange) => void;
  readonly onActiveSheetChange?: (event: ActiveSheetChangeEvent) => void;
  readonly onSelectionChange?: (selection: Selection) => void;
  readonly onCellEdit?: (event: CellEditEvent) => void;
  readonly onPaste?: (event: PasteEvent) => void;
  readonly onError?: (error: TegoSheetError) => void;
}

export interface TegoSheetProps extends TegoSheetCallbacks {
  readonly value?: WorkbookInput;
  readonly defaultValue?: WorkbookInput;
  readonly initialActiveSheetIndex?: number;
  readonly readOnly?: boolean;
  readonly locale?: LocaleDefinition;
  readonly options?: SheetOptions;
  readonly toolbar?: 'default' | false | ToolbarRenderer;
  readonly sheetTabs?: 'default' | false | SheetTabsRenderer;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface TegoSheetHandle {
  focus(): void;
  getValue(): WorkbookData;
  getCell(address: CellAddress): CellData | null;
  getCellStyle(address: CellAddress): CellStyle;
  setCellText(address: CellAddress, text: string): void;
  addSheet(name?: string): SheetId;
  deleteSheet(sheet: SheetId): void;
  renameSheet(sheet: SheetId, name: string): void;
  activateSheet(sheet: SheetId): void;
  undo(): void;
  redo(): void;
  validate(): ValidationResult;
  print(): void;
  recalculateLayout(): void;
}
