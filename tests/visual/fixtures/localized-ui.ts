import type { VisualFixture } from './types';

export const localizedUi: VisualFixture = {
  name: 'localized-ui',
  locale: 'de',
  workbook: [{
    name: 'Lokalisierung',
    rows: {
      len: 20,
      0: { cells: { 0: { text: 'Projekt' }, 1: { text: 'Verantwortlich' }, 2: { text: 'Status' } } },
      1: { cells: { 0: { text: 'Quartalsplan' }, 1: { text: 'Lina' }, 2: { text: 'In Arbeit' } } },
    },
    cols: { len: 7 },
  }],
};
