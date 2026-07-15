import type { VisualFixture } from './types';

export const printPreview: VisualFixture = {
  name: 'print-preview',
  workbook: [{
    name: 'Printable',
    merges: ['A1:C1'],
    styles: [{ bgcolor: '#e8f1ff', font: { name: 'Noto Sans Visual', bold: true }, border: { bottom: ['thick', '#4b89ff'] } }],
    rows: {
      len: 20,
      0: { height: 34, cells: { 0: { text: 'Print report', merge: [0, 2], style: 0 } } },
      1: { cells: { 0: { text: 'Visible' }, 1: { text: '42' }, 2: { text: 'private', printable: false } } },
    },
    cols: { len: 7, 0: { width: 150 }, 1: { width: 120 }, 2: { width: 120 } },
  }],
};
