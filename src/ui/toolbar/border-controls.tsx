import type { BorderMode, ToolbarRenderProps } from '../../core';
import type { Translate } from '../translate';

const borders = [
  ['all', 'All borders'],
  ['inside', 'Inside borders'],
  ['outside', 'Outside borders'],
  ['horizontal', 'Horizontal borders'],
  ['vertical', 'Vertical borders'],
  ['top', 'Top border'],
  ['bottom', 'Bottom border'],
  ['left', 'Left border'],
  ['right', 'Right border'],
  ['none', 'No borders'],
] as const;

export function BorderControls(props: {
  readonly toolbar: ToolbarRenderProps;
  readonly t: Translate;
}) {
  const disabled = props.toolbar.disabledActions.has('set-border');
  return (
    <select
      aria-label={props.t('toolbar.border', 'Borders')}
      defaultValue=""
      disabled={disabled}
      onChange={event => {
        const value = event.target.value;
        if (value !== '') {
          const mode = value as BorderMode;
          props.toolbar.execute(mode === 'none'
            ? { type: 'set-border', mode }
            : { type: 'set-border', mode, line: ['thin', '#000000'] });
        }
        event.currentTarget.value = '';
      }}
    >
      <option value="">{props.t('toolbar.border', 'Borders')}</option>
      {borders.map(([mode, label]) => (
        <option key={mode} value={mode}>{props.t(`border.${mode}`, label)}</option>
      ))}
    </select>
  );
}
