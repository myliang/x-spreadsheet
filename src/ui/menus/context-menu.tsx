import { useLayoutEffect, useRef } from 'react';
import type { ToolbarAction } from '../../core';
import type { CssPoint } from '../../engine';
import type { Translate } from '../translate';

export type ContextMenuAction =
  | ToolbarAction
  | { readonly type: 'copy' | 'cut' | 'paste' | 'paste-value' | 'paste-format' | 'clear-contents' }
  | {
    readonly type: 'set-cell-metadata';
    readonly property: 'editable' | 'printable';
    readonly value: boolean;
  };

interface ContextMenuItem {
  readonly id: string;
  readonly action: ContextMenuAction;
  readonly label: string;
}

const ACTIONS: readonly ContextMenuItem[] = [
  { id: 'copy', action: { type: 'copy' }, label: 'Copy' },
  { id: 'cut', action: { type: 'cut' }, label: 'Cut' },
  { id: 'paste', action: { type: 'paste' }, label: 'Paste' },
  { id: 'paste-value', action: { type: 'paste-value' }, label: 'Paste values only' },
  { id: 'paste-format', action: { type: 'paste-format' }, label: 'Paste format only' },
  { id: 'insert-row', action: { type: 'insert-row' }, label: 'Insert row' },
  { id: 'delete-row', action: { type: 'delete-row' }, label: 'Delete row' },
  { id: 'hide-row', action: { type: 'hide-row' }, label: 'Hide row' },
  { id: 'unhide-row', action: { type: 'unhide-row' }, label: 'Unhide row' },
  { id: 'insert-column', action: { type: 'insert-column' }, label: 'Insert column' },
  { id: 'delete-column', action: { type: 'delete-column' }, label: 'Delete column' },
  { id: 'hide-column', action: { type: 'hide-column' }, label: 'Hide column' },
  { id: 'unhide-column', action: { type: 'unhide-column' }, label: 'Unhide column' },
  { id: 'clear-contents', action: { type: 'clear-contents' }, label: 'Clear contents' },
  { id: 'clear-format', action: { type: 'clear-format' }, label: 'Clear format' },
  {
    id: 'printable-true',
    action: { type: 'set-cell-metadata', property: 'printable', value: true },
    label: 'Enable export',
  },
  {
    id: 'printable-false',
    action: { type: 'set-cell-metadata', property: 'printable', value: false },
    label: 'Disable export',
  },
  {
    id: 'editable-true',
    action: { type: 'set-cell-metadata', property: 'editable', value: true },
    label: 'Enable editing',
  },
  {
    id: 'editable-false',
    action: { type: 'set-cell-metadata', property: 'editable', value: false },
    label: 'Disable editing',
  },
];

function actionDisabled(
  action: ContextMenuAction,
  disabled: ReadonlySet<ToolbarAction['type']>,
  readOnly: boolean,
): boolean {
  switch (action.type) {
    case 'copy':
      return false;
    case 'cut':
    case 'paste':
    case 'paste-value':
    case 'paste-format':
    case 'clear-contents':
    case 'set-cell-metadata':
      return readOnly;
    default:
      return disabled.has(action.type);
  }
}

export function ContextMenu(props: {
  readonly point: CssPoint;
  readonly disabled: ReadonlySet<ToolbarAction['type']>;
  readonly readOnly: boolean;
  readonly execute: (action: ContextMenuAction) => void;
  readonly onClose: () => void;
  readonly onOpenFilter: () => void;
  readonly onOpenValidation: () => void;
  readonly t: Translate;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={props.t('context.label', 'Cell actions')}
      tabIndex={-1}
      className="tego-sheet__context-menu"
      style={{ position: 'absolute', left: props.point.x, top: props.point.y }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) props.onClose();
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') props.onClose();
      }}
    >
      {ACTIONS.map(item => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={actionDisabled(item.action, props.disabled, props.readOnly)}
          onClick={() => {
            props.execute(item.action);
            props.onClose();
          }}
        >{props.t(`context.${item.id}`, item.label)}</button>
      ))}
      <button type="button" role="menuitem" disabled={props.disabled.has('set-validation')} onClick={props.onOpenValidation}>
        {props.t('toolbar.validation', 'Data validation')}
      </button>
      <button type="button" role="menuitem" disabled={props.disabled.has('set-filter')} onClick={props.onOpenFilter}>
        {props.t('toolbar.filter', 'Filter')}
      </button>
    </div>
  );
}
