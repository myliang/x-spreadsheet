import type { VisualFixture } from './types';

export const mergedCells: VisualFixture = {
  name: 'merged-cells',
  workbook: [{
    name: 'Merges',
    merges: ['A1:C2', 'D4:F4'],
    styles: [{ bgcolor: '#e8f1ff', align: 'center', valign: 'middle', font: { name: 'Noto Sans Visual', size: 14, bold: true }, border: { bottom: ['medium', '#4b89ff'] } }],
    rows: {
      len: 20,
      0: { height: 32, cells: { 0: { text: 'Merged title', merge: [1, 2], style: 0 } } },
      1: { height: 32 },
      3: { cells: { 3: { text: 'Section', merge: [0, 2], style: 0 } } },
    },
    cols: { len: 8 },
  }],
};
