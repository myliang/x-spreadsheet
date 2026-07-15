import type { VisualFixture } from './types';

export const multipleSheetTabs: VisualFixture = {
  name: 'multiple-sheet-tabs',
  workbook: [
    { name: 'Summary', rows: { len: 18, 0: { cells: { 0: { text: 'Summary sheet' } } } }, cols: { len: 7 } },
    { name: 'Revenue 2026', rows: { len: 18, 0: { cells: { 0: { text: 'Revenue' } } } }, cols: { len: 7 } },
    { name: 'Operations', rows: { len: 18, 0: { cells: { 0: { text: 'Operations' } } } }, cols: { len: 7 } },
  ],
};
