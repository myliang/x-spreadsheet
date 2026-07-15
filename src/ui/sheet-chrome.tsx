import type { ReactNode } from 'react';
import type {
  FilterDefinition,
  LocaleDefinition,
  Selection,
  SheetTabsRenderProps,
  TegoSheetError,
  ToolbarAction,
  ToolbarRenderProps,
  ValidationRule,
} from '../core';
import type { CssPoint, OverlayAnchor } from '../engine';
import type { SheetTabsRenderer, ToolbarRenderer } from './slot-types';
import { PrintDialog } from './dialogs/print-dialog';
import { ValidationDialog } from './dialogs/validation-dialog';
import { CellEditor } from './editor/cell-editor';
import { ContextMenu, type ContextMenuAction } from './menus/context-menu';
import { FilterMenu } from './menus/filter-menu';
import { NotificationHost } from './notifications/notification-host';
import { SheetTabs } from './tabs/sheet-tabs';
import { DefaultToolbar } from './toolbar/default-toolbar';
import { createTranslator } from './translate';
import type { PrintWorkbookOptions } from './print-workbook';

export interface ChromeEditor {
  readonly anchor: OverlayAnchor;
  readonly date: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly onCommit: (move?: 'up' | 'down' | 'left' | 'right') => void;
}

export interface ChromeContextMenu {
  readonly point: CssPoint;
  readonly selection: Selection;
}

export interface SheetChromeProps {
  readonly toolbar: ToolbarRenderProps;
  readonly toolbarRenderer: 'default' | false | ToolbarRenderer | undefined;
  readonly tabs: SheetTabsRenderProps;
  readonly tabsRenderer: 'default' | false | SheetTabsRenderer | undefined;
  readonly locale: LocaleDefinition | undefined;
  readonly children: ReactNode;
  readonly editor: ChromeEditor | null;
  readonly contextMenu: ChromeContextMenu | null;
  readonly filterColumn: number | null;
  readonly filterValues: readonly string[];
  readonly filterOpen: boolean;
  readonly notification: TegoSheetError | null;
  readonly paintFormatActive: boolean;
  readonly printOpen: boolean;
  readonly validationOpen: boolean;
  readonly onCloseContextMenu: () => void;
  readonly onCloseFilter: () => void;
  readonly onClosePrint: () => void;
  readonly onCloseValidation: () => void;
  readonly onDismissNotification: () => void;
  readonly onExecute: (action: ToolbarAction) => void;
  readonly onExecuteContext: (action: ContextMenuAction) => void;
  readonly onFilter: (filter: FilterDefinition) => void;
  readonly onOpenFilter: () => void;
  readonly onOpenPrint: () => void;
  readonly onOpenValidation: () => void;
  readonly onOpenContextFilter: () => void;
  readonly onOpenContextValidation: () => void;
  readonly onPrint: (options: PrintWorkbookOptions) => void;
  readonly onRemoveValidation: () => void;
  readonly onValidation: (rule: ValidationRule) => void;
}

export function SheetChrome(props: SheetChromeProps) {
  const t = createTranslator(props.locale);
  const toolbar = props.toolbarRenderer === false ? null
    : typeof props.toolbarRenderer === 'function'
      ? <div data-tego-toolbar="custom">{props.toolbarRenderer(props.toolbar)}</div>
      : (
        <DefaultToolbar
          toolbar={props.toolbar}
          t={t}
          paintFormatActive={props.paintFormatActive}
          onOpenFilter={props.onOpenFilter}
          onOpenPrint={props.onOpenPrint}
          onOpenValidation={props.onOpenValidation}
        />
      );
  const tabs = props.tabsRenderer === false ? null
    : typeof props.tabsRenderer === 'function'
      ? <div data-tego-sheet-tabs="custom">{props.tabsRenderer(props.tabs)}</div>
      : props.tabs.sheets.length === 0 ? null : <SheetTabs tabs={props.tabs} t={t} />;
  return (
    <>
      {toolbar}
      <div className="tego-sheet__viewport">
        {props.children}
        {props.editor === null ? null : <CellEditor {...props.editor} />}
        {props.contextMenu === null ? null : (
          <ContextMenu
            point={props.contextMenu.point}
            disabled={props.toolbar.disabledActions}
            readOnly={props.toolbar.readOnly}
            execute={props.onExecuteContext}
            onClose={props.onCloseContextMenu}
            onOpenFilter={props.onOpenContextFilter}
            onOpenValidation={props.onOpenContextValidation}
            t={t}
          />
        )}
      </div>
      {tabs}
      {props.validationOpen ? (
        <ValidationDialog
          t={t}
          onClose={props.onCloseValidation}
          onRemove={props.onRemoveValidation}
          onSave={props.onValidation}
        />
      ) : null}
      {props.filterOpen && props.filterColumn !== null ? (
        <FilterMenu
          t={t}
          column={props.filterColumn}
          values={props.filterValues}
          onClose={props.onCloseFilter}
          onApply={props.onFilter}
        />
      ) : null}
      {props.printOpen ? (
        <PrintDialog t={t} onClose={props.onClosePrint} onPrint={props.onPrint} />
      ) : null}
      <NotificationHost error={props.notification} onDismiss={props.onDismissNotification} />
    </>
  );
}
