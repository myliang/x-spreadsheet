import type { VisualFixture } from './types';

export const validationFilterUi: VisualFixture = {
  name: 'validation-filter-ui',
  workbook: [{
    name: 'Data tools',
    autofilter: { ref: 'A1:C8' },
    validations: [{ refs: ['B2:B8'], mode: 'cell', type: 'number', required: true, operator: 'gte', value: 0 }],
    rows: {
      len: 18,
      0: { cells: { 0: { text: 'Region' }, 1: { text: 'Score' }, 2: { text: 'Status' } } },
      1: { cells: { 0: { text: 'North' }, 1: { text: '82' }, 2: { text: 'Open' } } },
      2: { cells: { 0: { text: 'South' }, 1: { text: '74' }, 2: { text: 'Closed' } } },
      3: { cells: { 0: { text: 'West' }, 1: { text: '91' }, 2: { text: 'Open' } } },
    },
    cols: { len: 7 },
  }],
};
