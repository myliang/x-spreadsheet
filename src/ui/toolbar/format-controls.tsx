import type { ToolbarRenderProps } from '../../core';
import type { Translate } from '../translate';
import { ToolbarButton } from './toolbar-button';

export interface FormatControlsProps {
  readonly toolbar: ToolbarRenderProps;
  readonly t: Translate;
}

export function FormatControls({ toolbar, t }: FormatControlsProps) {
  const disabled = toolbar.disabledActions.has('set-style');
  const style = toolbar.activeStyle;
  const font = style.font ?? {};
  const setStyle = (patch: Parameters<ToolbarRenderProps['execute']>[0] & { type: 'set-style' }) => {
    toolbar.execute(patch);
  };
  return (
    <div className="tego-sheet__format-controls" role="group" aria-label={t('toolbar.formatting', 'Formatting')}>
      <select
        aria-label={t('toolbar.format', 'Number format')}
        value={typeof style.format === 'string' ? style.format : 'normal'}
        disabled={disabled}
        onChange={event => setStyle({ type: 'set-style', patch: { format: event.target.value } })}
      >
        {['normal', 'number', 'percent', 'rmb', 'usd', 'eur', 'date', 'time', 'datetime', 'duration'].map(value => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
      <select
        aria-label={t('toolbar.fontName', 'Font')}
        value={font.name ?? 'Arial'}
        disabled={disabled}
        onChange={event => setStyle({ type: 'set-style', patch: { font: { ...font, name: event.target.value } } })}
      >
        {['Arial', 'Helvetica', 'Times New Roman', 'Courier New'].map(value => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
      <input
        aria-label={t('toolbar.fontSize', 'Font size')}
        type="number"
        min={1}
        max={200}
        value={font.size ?? 10}
        disabled={disabled}
        onChange={event => setStyle({
          type: 'set-style',
          patch: { font: { ...font, size: Number(event.target.value) } },
        })}
      />
      <ToolbarButton
        icon="bold"
        active={font.bold === true}
        disabled={disabled}
        onClick={() => setStyle({ type: 'set-style', patch: { font: { ...font, bold: font.bold !== true } } })}
      >{t('toolbar.bold', 'Bold')}</ToolbarButton>
      <ToolbarButton
        icon="italic"
        active={font.italic === true}
        disabled={disabled}
        onClick={() => setStyle({ type: 'set-style', patch: { font: { ...font, italic: font.italic !== true } } })}
      >{t('toolbar.italic', 'Italic')}</ToolbarButton>
      <ToolbarButton
        icon="underline"
        active={style.underline === true}
        disabled={disabled}
        onClick={() => setStyle({ type: 'set-style', patch: { underline: style.underline !== true } })}
      >{t('toolbar.underline', 'Underline')}</ToolbarButton>
      <ToolbarButton
        icon="strike"
        active={style.strike === true}
        disabled={disabled}
        onClick={() => setStyle({ type: 'set-style', patch: { strike: style.strike !== true } })}
      >{t('toolbar.strike', 'Strike')}</ToolbarButton>
      <input
        aria-label={t('toolbar.textColor', 'Text color')}
        type="color"
        value={typeof style.color === 'string' ? style.color : '#000000'}
        disabled={disabled}
        onChange={event => setStyle({ type: 'set-style', patch: { color: event.target.value } })}
      />
      <input
        aria-label={t('toolbar.fillColor', 'Fill color')}
        type="color"
        value={typeof style.bgcolor === 'string' ? style.bgcolor : '#ffffff'}
        disabled={disabled}
        onChange={event => setStyle({ type: 'set-style', patch: { bgcolor: event.target.value } })}
      />
      <select
        aria-label={t('toolbar.align', 'Horizontal align')}
        value={style.align ?? 'left'}
        disabled={disabled}
        onChange={event => setStyle({
          type: 'set-style',
          patch: { align: event.target.value as 'left' | 'center' | 'right' },
        })}
      >
        <option value="left">{t('toolbar.alignLeft', 'Left')}</option>
        <option value="center">{t('toolbar.alignCenter', 'Center')}</option>
        <option value="right">{t('toolbar.alignRight', 'Right')}</option>
      </select>
      <select
        aria-label={t('toolbar.valign', 'Vertical align')}
        value={style.valign ?? 'bottom'}
        disabled={disabled}
        onChange={event => setStyle({
          type: 'set-style',
          patch: { valign: event.target.value as 'top' | 'middle' | 'bottom' },
        })}
      >
        <option value="top">{t('toolbar.alignTop', 'Top')}</option>
        <option value="middle">{t('toolbar.alignMiddle', 'Middle')}</option>
        <option value="bottom">{t('toolbar.alignBottom', 'Bottom')}</option>
      </select>
      <ToolbarButton
        icon="wrap"
        active={style.textwrap === true}
        disabled={disabled}
        onClick={() => setStyle({ type: 'set-style', patch: { textwrap: style.textwrap !== true } })}
      >{t('toolbar.wrap', 'Wrap text')}</ToolbarButton>
    </div>
  );
}
