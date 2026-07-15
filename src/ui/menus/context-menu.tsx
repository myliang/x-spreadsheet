import { useLayoutEffect, useRef } from 'react';
import type { ToolbarAction } from '../../core';
import type { CssPoint } from '../../engine';
import type { Translate } from '../translate';

const ACTIONS: readonly { readonly action: ToolbarAction; readonly label: string }[] = [
  { action: { type: 'insert-row' }, label: 'Insert row' },
  { action: { type: 'delete-row' }, label: 'Delete row' },
  { action: { type: 'hide-row' }, label: 'Hide row' },
  { action: { type: 'unhide-row' }, label: 'Unhide row' },
  { action: { type: 'insert-column' }, label: 'Insert column' },
  { action: { type: 'delete-column' }, label: 'Delete column' },
  { action: { type: 'hide-column' }, label: 'Hide column' },
  { action: { type: 'unhide-column' }, label: 'Unhide column' },
  { action: { type: 'clear-format' }, label: 'Clear format' },
];

export function ContextMenu(props: {
  readonly point: CssPoint;
  readonly disabled: ReadonlySet<ToolbarAction['type']>;
  readonly execute: (action: ToolbarAction) => void;
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
          key={item.action.type}
          type="button"
          role="menuitem"
          disabled={props.disabled.has(item.action.type)}
          onClick={() => {
            props.execute(item.action);
            props.onClose();
          }}
        >{props.t(`context.${item.action.type}`, item.label)}</button>
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
