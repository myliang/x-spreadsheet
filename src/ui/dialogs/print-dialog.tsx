import { useState } from 'react';
import type { PaperOrientation, PaperSizeName } from '../../engine';
import type { Translate } from '../translate';
import type { PrintWorkbookOptions } from '../print-workbook';

export function PrintDialog(props: {
  readonly onClose: () => void;
  readonly onPrint: (options: PrintWorkbookOptions) => void;
  readonly t: Translate;
}) {
  const [orientation, setOrientation] = useState<PaperOrientation>('portrait');
  const [paper, setPaper] = useState<PaperSizeName>('A4');
  return (
    <div role="dialog" aria-modal="true" aria-label={props.t('print.title', 'Print')} className="tego-sheet__dialog">
      <label>{props.t('print.paper', 'Paper')}
        <select value={paper} onChange={event => setPaper(event.target.value as PaperSizeName)}>
          {(['A3', 'A4', 'A5', 'B4', 'B5'] as const).map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>{props.t('print.orientation', 'Orientation')}
        <select value={orientation} onChange={event => setOrientation(event.target.value as PaperOrientation)}>
          <option value="portrait">{props.t('print.portrait', 'Portrait')}</option>
          <option value="landscape">{props.t('print.landscape', 'Landscape')}</option>
        </select>
      </label>
      <button type="button" onClick={() => props.onPrint({ orientation, paper })}>{props.t('print.print', 'Print')}</button>
      <button type="button" onClick={props.onClose}>{props.t('common.cancel', 'Cancel')}</button>
    </div>
  );
}
