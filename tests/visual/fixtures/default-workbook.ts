import type { VisualFixture } from './types';

export const defaultWorkbook: VisualFixture = {
  name: 'default-workbook',
  workbook: [{
    name: 'Quarterly plan',
    rows: {
      len: 30,
      0: { cells: { 0: { text: 'Item' }, 1: { text: 'Owner' }, 2: { text: 'Units' }, 3: { text: 'Price' }, 4: { text: 'Total' } } },
      1: { cells: { 0: { text: 'Paper' }, 1: { text: 'Ada' }, 2: { text: '12' }, 3: { text: '4.50' }, 4: { text: '=C2*D2' } } },
      2: { cells: { 0: { text: 'Ink' }, 1: { text: 'Lin' }, 2: { text: '7' }, 3: { text: '12' }, 4: { text: '=C3*D3' } } },
      3: { cells: { 0: { text: 'Labels' }, 1: { text: 'Sam' }, 2: { text: '24' }, 3: { text: '1.25' }, 4: { text: '=C4*D4' } } },
    },
    cols: { len: 8 },
  }],
};
