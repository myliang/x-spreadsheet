import type { Locator, Page } from '@playwright/test';
import type { VisualMaskName } from './fixtures/types';

const maskLocators: Record<VisualMaskName, (page: Page) => Locator> = {
  'blinking-caret': page => page.locator('.tego-sheet__editor textarea'),
  'native-scrollbars': page => page.locator('.tego-sheet__context-menu, .tego-sheet__filter-menu'),
};

export function namedMasks(page: Page, names: readonly VisualMaskName[]): readonly Locator[] {
  return names.map(name => maskLocators[name](page));
}
