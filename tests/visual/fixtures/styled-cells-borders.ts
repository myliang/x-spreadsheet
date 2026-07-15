import type { VisualFixture } from './types';

export const styledCellsBorders: VisualFixture = {
  name: 'styled-cells-borders',
  workbook: [{
    name: 'Styles',
    styles: [
      { bgcolor: '#e8f1ff', color: '#174ea6', font: { name: 'Noto Sans Visual', size: 12, bold: true }, border: { bottom: ['thick', '#4b89ff'] } },
      { bgcolor: '#fff4ce', align: 'center', font: { name: 'Noto Sans Visual', italic: true }, border: { top: ['dashed', '#d97706'], right: ['medium', '#d97706'], bottom: ['dashed', '#d97706'], left: ['medium', '#d97706'] } },
      { bgcolor: '#e7f6ec', color: '#137333', align: 'right', underline: true },
    ],
    rows: {
      len: 18,
      0: { height: 36, cells: { 0: { text: 'Styled cells', style: 0 }, 1: { text: 'Borders', style: 1 }, 2: { text: 'Aligned', style: 2 } } },
      1: { cells: { 0: { text: 'Blue header', style: 0 }, 1: { text: 'Dashed box', style: 1 }, 2: { text: 'Right edge', style: 2 } } },
    },
    cols: { len: 7, 0: { width: 150 }, 1: { width: 140 }, 2: { width: 130 } },
  }],
};
