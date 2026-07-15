import type { Locator, Page } from '@playwright/test';
import type { VisualMaskName } from './fixtures/types';

export const visualMaskSelectors = {
  'blinking-caret': '[data-visual-mask="blinking-caret"]',
  'native-scrollbars': '[data-visual-mask="native-scrollbars"]',
} as const satisfies Record<VisualMaskName, string>;

export function namedMasks(page: Page, names: readonly VisualMaskName[]): readonly Locator[] {
  return names.map(name => page.locator(visualMaskSelectors[name]));
}
