import { defaultWorkbook } from './default-workbook';
import { editingOverlaysMenus } from './editing-overlays-menus';
import { frozenPanes } from './frozen-panes';
import { localizedUi } from './localized-ui';
import { mergedCells } from './merged-cells';
import { multipleSheetTabs } from './multiple-sheet-tabs';
import { printPreview } from './print-preview';
import { resizedHiddenStructure } from './resized-hidden-structure';
import { styledCellsBorders } from './styled-cells-borders';
import { touchInteraction } from './touch-interaction';
import type { VisualFixture } from './types';
import { validationFilterUi } from './validation-filter-ui';

export const visualFixtures: readonly VisualFixture[] = [
  defaultWorkbook,
  styledCellsBorders,
  mergedCells,
  frozenPanes,
  resizedHiddenStructure,
  editingOverlaysMenus,
  validationFilterUi,
  multipleSheetTabs,
  printPreview,
  localizedUi,
  touchInteraction,
];

export function visualFixture(name: string): VisualFixture {
  const fixture = visualFixtures.find(candidate => candidate.name === name);
  if (fixture === undefined) throw new Error(`Unknown visual fixture: ${name}`);
  return fixture;
}
