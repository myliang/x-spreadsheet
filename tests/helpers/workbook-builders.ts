import type { SheetData } from '../../src/core';

export function buildStyledWorkbook(): SheetData {
  return {
    name: 'Canvas',
    freeze: 'B2',
    styles: [
      {
        format: 'number',
        bgcolor: '#ffeecc',
        align: 'right',
        valign: 'middle',
        textwrap: true,
        underline: true,
        color: '#123456',
        font: { name: 'Inter', size: 12, bold: true, italic: true },
        border: {
          top: ['medium', '#ff0000'],
          right: ['dashed', '#00ff00'],
          bottom: ['double', '#0000ff'],
          left: ['dotted', '#333333'],
        },
      },
    ],
    merges: ['C3:D4'],
    rows: {
      len: 8,
      0: {
        height: 30,
        cells: {
          0: { text: '1234', style: 0 },
          5: { text: 'screen-only', printable: false },
        },
      },
      1: { height: 28, cells: { 1: { text: '=A1+1' } } },
      2: {
        cells: {
          2: { text: 'merged', merge: [1, 1], editable: false },
          4: { text: 'invalid' },
        },
      },
    },
    cols: {
      len: 8,
      0: { width: 90 },
      1: { width: 110 },
      2: { width: 80 },
      3: { width: 120 },
    },
    autofilter: {
      ref: 'A1:E5',
      filters: [{ ci: 4, operator: 'in', value: ['invalid'] }],
    },
  };
}
