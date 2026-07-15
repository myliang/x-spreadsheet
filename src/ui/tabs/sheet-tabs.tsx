import { useRef, useState, type KeyboardEvent } from 'react';
import type { SheetId, SheetTabsRenderProps } from '../../core';
import type { Translate } from '../translate';

export function SheetTabs(props: { readonly tabs: SheetTabsRenderProps; readonly t: Translate }) {
  const [renaming, setRenaming] = useState<SheetId | null>(null);
  const tabRefs = useRef(new Map<SheetId, HTMLButtonElement>());
  const activeTab = props.tabs.sheets.some(sheet => sheet.id === props.tabs.activeSheet)
    ? props.tabs.activeSheet
    : props.tabs.sheets[0]?.id ?? null;

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, currentSheet: SheetId) {
    const currentIndex = props.tabs.sheets.findIndex(sheet => sheet.id === currentSheet);
    if (currentIndex < 0 || props.tabs.sheets.length === 0) return;

    let targetIndex: number;
    switch (event.key) {
      case 'ArrowLeft':
        targetIndex = (currentIndex - 1 + props.tabs.sheets.length) % props.tabs.sheets.length;
        break;
      case 'ArrowRight':
        targetIndex = (currentIndex + 1) % props.tabs.sheets.length;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = props.tabs.sheets.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const target = props.tabs.sheets[targetIndex];
    if (target === undefined) return;
    props.tabs.activate(target.id);
    tabRefs.current.get(target.id)?.focus();
  }

  return (
    <div className="tego-sheet__tabs" data-tego-sheet-tabs="default">
      <div role="tablist" aria-label={props.t('tabs.label', 'Sheets')}>
        {props.tabs.sheets.map(sheet => renaming === sheet.id ? (
          <input
            key={sheet.id}
            aria-label={props.t('tabs.rename', 'Rename sheet')}
            defaultValue={sheet.name}
            autoFocus
            onBlur={event => {
              props.tabs.rename(sheet.id, event.currentTarget.value);
              setRenaming(null);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setRenaming(null);
            }}
          />
        ) : (
          <span key={sheet.id} className="tego-sheet__tab-item">
            <button
              type="button"
              role="tab"
              aria-selected={props.tabs.activeSheet === sheet.id}
              tabIndex={activeTab === sheet.id ? 0 : -1}
              ref={element => {
                if (element === null) tabRefs.current.delete(sheet.id);
                else tabRefs.current.set(sheet.id, element);
              }}
              onClick={() => props.tabs.activate(sheet.id)}
              onKeyDown={event => navigateTabs(event, sheet.id)}
              onDoubleClick={() => {
                if (!props.tabs.readOnly) setRenaming(sheet.id);
              }}
            >{sheet.name || `${props.t('tabs.sheet', 'Sheet')} ${sheet.index + 1}`}</button>
            <button
              type="button"
              aria-label={`${props.t('tabs.delete', 'Delete sheet')} ${sheet.name}`}
              disabled={props.tabs.readOnly}
              onClick={() => props.tabs.delete(sheet.id)}
            >×</button>
          </span>
        ))}
      </div>
      <button
        type="button"
        disabled={props.tabs.readOnly}
        onClick={() => props.tabs.add()}
      >{props.t('tabs.add', 'Add sheet')}</button>
    </div>
  );
}
