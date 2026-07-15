import { useState } from 'react';
import type { FilterDefinition } from '../../core';
import type { Translate } from '../translate';

export function FilterMenu(props: {
  readonly column: number;
  readonly values: readonly string[];
  readonly onApply: (filter: FilterDefinition) => void;
  readonly onClose: () => void;
  readonly t: Translate;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(props.values));
  return (
    <div role="dialog" aria-modal="true" aria-label={props.t('filter.title', 'Filter')} className="tego-sheet__filter-menu">
      <fieldset>
        <legend>{props.t('filter.values', 'Values')}</legend>
        {props.values.map(value => (
          <label key={value}>
            <input
              type="checkbox"
              checked={selected.has(value)}
              onChange={event => {
                const checked = event.currentTarget.checked;
                setSelected(current => {
                const next = new Set(current);
                if (checked) next.add(value);
                else next.delete(value);
                return next;
                });
              }}
            />
            {value || props.t('filter.empty', 'Empty')}
          </label>
        ))}
      </fieldset>
      <button type="button" onClick={() => props.onApply({
        column: props.column,
        operator: selected.size === props.values.length ? 'all' : 'in',
        value: [...selected],
      })}>{props.t('filter.apply', 'Apply filter')}</button>
      <button type="button" onClick={props.onClose}>{props.t('common.cancel', 'Cancel')}</button>
    </div>
  );
}
