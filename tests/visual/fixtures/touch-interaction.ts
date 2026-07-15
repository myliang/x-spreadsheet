import type { VisualFixture } from './types';

export const touchInteraction: VisualFixture = {
  name: 'touch-interaction',
  workbook: [{
    name: 'Touch',
    rows: {
      len: 40,
      0: { cells: { 0: { text: 'Tap a cell' }, 1: { text: 'Swipe the grid' } } },
      1: { cells: { 0: { text: 'Selected on touch' }, 1: { text: 'Stable content' } } },
      2: { cells: { 0: { text: 'Row three' } } },
    },
    cols: { len: 8 },
  }],
};
