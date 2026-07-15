import type { ToolbarAction, ToolbarRenderProps } from '../../core';
import type { Translate } from '../translate';
import { BorderControls } from './border-controls';
import { FormatControls } from './format-controls';
import { ToolbarButton, type ToolbarIconName } from './toolbar-button';

export interface DefaultToolbarProps {
  readonly toolbar: ToolbarRenderProps;
  readonly t: Translate;
  readonly paintFormatActive: boolean;
  readonly onOpenFilter: () => void;
  readonly onOpenPrint: () => void;
  readonly onOpenValidation: () => void;
}

export function DefaultToolbar(props: DefaultToolbarProps) {
  const { toolbar, t } = props;
  const icons: Partial<Record<ToolbarAction['type'], ToolbarIconName>> = {
    undo: 'undo',
    redo: 'redo',
    print: 'print',
    'paint-format': 'paint',
    'clear-format': 'clear',
    merge: 'merge',
    unmerge: 'merge',
    freeze: 'freeze',
    unfreeze: 'freeze',
    'clear-filter': 'filter',
    sort: 'sort',
  };
  const button = (action: ToolbarAction, label: string, active?: boolean) => (
    <ToolbarButton
      key={`${action.type}-${label}`}
      {...(active === undefined ? {} : { active })}
      {...(icons[action.type] === undefined ? {} : { icon: icons[action.type] })}
      disabled={toolbar.disabledActions.has(action.type)}
      onClick={() => toolbar.execute(action)}
    >{label}</ToolbarButton>
  );
  const mutating = toolbar.readOnly || toolbar.selection === null;
  return (
    <div className="tego-sheet__toolbar" data-tego-toolbar="default" role="toolbar" aria-label={t('toolbar.label', 'Spreadsheet toolbar')}>
      {button({ type: 'undo' }, t('toolbar.undo', 'Undo'))}
      {button({ type: 'redo' }, t('toolbar.redo', 'Redo'))}
      <ToolbarButton icon="print" disabled={toolbar.disabledActions.has('print')} onClick={props.onOpenPrint}>
        {t('toolbar.print', 'Print')}
      </ToolbarButton>
      {button({ type: 'paint-format' }, t('toolbar.paintFormat', 'Paint format'), props.paintFormatActive)}
      {button({ type: 'clear-format' }, t('toolbar.clearFormat', 'Clear format'))}
      <FormatControls toolbar={toolbar} t={t} />
      <BorderControls toolbar={toolbar} t={t} />
      {button({ type: toolbar.merged ? 'unmerge' : 'merge' }, toolbar.merged
        ? t('toolbar.unmerge', 'Unmerge')
        : t('toolbar.merge', 'Merge'), toolbar.merged)}
      {button({ type: toolbar.frozen ? 'unfreeze' : 'freeze' }, toolbar.frozen
        ? t('toolbar.unfreeze', 'Unfreeze')
        : t('toolbar.freeze', 'Freeze'), toolbar.frozen)}
      <ToolbarButton icon="validation" disabled={mutating} onClick={props.onOpenValidation}>
        {t('toolbar.validation', 'Data validation')}
      </ToolbarButton>
      <ToolbarButton icon="filter" disabled={mutating} onClick={props.onOpenFilter}>
        {t('toolbar.filter', 'Filter')}
      </ToolbarButton>
      {button({ type: 'clear-filter' }, t('toolbar.clearFilter', 'Clear filter'))}
      {button({ type: 'sort', order: 'asc' }, t('toolbar.sortAsc', 'Sort ascending'))}
      {button({ type: 'sort', order: 'desc' }, t('toolbar.sortDesc', 'Sort descending'))}
    </div>
  );
}
