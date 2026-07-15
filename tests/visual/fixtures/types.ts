import type { LocaleDefinition, WorkbookData } from 'tego-sheet';
import type { VisualFixtureName } from '../parity';

export type VisualLocale = 'de' | 'en';
export type VisualMaskName = 'blinking-caret' | 'native-scrollbars';

export interface VisualFixture {
  readonly name: VisualFixtureName;
  readonly workbook: WorkbookData;
  readonly locale?: VisualLocale;
  readonly masks?: readonly VisualMaskName[];
}

export type PublicLocale = LocaleDefinition;
