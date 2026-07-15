import type { BorderMode, ToolbarRenderProps } from '../../core';
import type { Translate } from '../translate';

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
      {['all', 'inside', 'outside', 'horizontal', 'vertical', 'top', 'bottom', 'left', 'right', 'none'].map(mode => (
        <option key={mode} value={mode}>{mode}</option>
      ))}
    </select>
  );
}
