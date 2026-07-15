export const geometryParityToken = '@parity:selection.active-range';
export const printableCellsParityToken = '@parity:correction.printable-cells-visual';

export const visualParityByFixture = {
  'default-workbook': '@parity:workbook.initial-grid',
  'styled-cells-borders': '@parity:formatting.styled-cells',
  'merged-cells': '@parity:ranges.merged-selection',
  'frozen-panes': '@parity:view.frozen-panes',
  'resized-hidden-structure': '@parity:structure.hidden-resized-grid',
  'editing-overlays-menus': '@parity:editing.editor-overlay',
  'validation-filter-ui': '@parity:tools.filtered-grid',
  'multiple-sheet-tabs': '@parity:workbook.initial-grid',
  'print-preview': '@parity:output.print-preview',
  'localized-ui': '@parity:locale.localized-ui',
  'touch-interaction': '@parity:input.touch-handles',
} as const;

export type VisualFixtureName = keyof typeof visualParityByFixture;
