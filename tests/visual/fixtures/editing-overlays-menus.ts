import type { VisualFixture } from './types';

export const editingOverlaysMenus: VisualFixture = {
  name: 'editing-overlays-menus',
  workbook: [{
    name: 'Editing',
    rows: {
      len: 24,
      0: { cells: { 0: { text: 'Formula' }, 1: { text: 'Value' } } },
      1: { cells: { 0: { text: '=SUM(B2:B4)' }, 1: { text: '10' } } },
      2: { cells: { 1: { text: '20' } } },
      3: { cells: { 1: { text: '30' } } },
    },
    cols: { len: 8 },
  }],
};
