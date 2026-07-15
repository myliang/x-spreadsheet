import type { Translate } from './translate';

export function EmptyWorkbook(props: {
  readonly readOnly: boolean;
  readonly onAddSheet: () => void;
  readonly t: Translate;
}) {
  return (
    <div className="tego-sheet__empty" data-empty-workbook="">
      <span>{props.t('empty.title', 'Empty workbook')}</span>
      {props.readOnly ? null : (
        <button type="button" onClick={props.onAddSheet}>
          {props.t('tabs.add', 'Add sheet')}
        </button>
      )}
    </div>
  );
}
