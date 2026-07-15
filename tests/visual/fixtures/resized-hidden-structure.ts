import type { VisualFixture } from './types';

export const resizedHiddenStructure: VisualFixture = {
  name: 'resized-hidden-structure',
  workbook: [{
    name: 'Structure',
    rows: {
      len: 28,
      0: { height: 42, cells: { 0: { text: 'Wide column' }, 1: { text: 'Hidden next' }, 2: { text: 'Visible C' } } },
      1: { hide: true, cells: { 0: { text: 'hidden row' } } },
      2: { height: 34, cells: { 0: { text: 'Row 3' }, 2: { text: 'After hidden row' } } },
    },
    cols: { len: 9, 0: { width: 180 }, 1: { hide: true }, 2: { width: 145 } },
  }],
};
