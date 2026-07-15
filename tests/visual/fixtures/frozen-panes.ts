import type { VisualFixture } from './types';

export const frozenPanes: VisualFixture = {
  name: 'frozen-panes',
  workbook: [{
    name: 'Frozen',
    freeze: 'B2',
    rows: {
      len: 36,
      0: { cells: { 0: { text: 'Pinned' }, 1: { text: 'January' }, 2: { text: 'February' }, 3: { text: 'March' } } },
      1: { cells: { 0: { text: 'North' }, 1: { text: '18' }, 2: { text: '22' }, 3: { text: '27' } } },
      2: { cells: { 0: { text: 'South' }, 1: { text: '14' }, 2: { text: '19' }, 3: { text: '25' } } },
    },
    cols: { len: 10 },
  }],
};
