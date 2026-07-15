import {
  TegoSheet,
  TegoSheetException,
  type LocaleDefinition,
  type TegoSheetProps,
  type WorkbookData,
} from 'tego-sheet';
import packageJson from 'tego-sheet/package.json' with { type: 'json' };
import { de } from 'tego-sheet/locales/de';
import { en } from 'tego-sheet/locales/en';
import { nl } from 'tego-sheet/locales/nl';
import { zhCN } from 'tego-sheet/locales/zh-cn';

const component: typeof TegoSheet = TegoSheet;
const props: TegoSheetProps = { defaultValue: [] };
const workbook: WorkbookData = [];
const locales: readonly LocaleDefinition[] = [en, de, nl, zhCN];
const exception = new TegoSheetException({
  code: 'INVALID_COMMAND', message: 'esm declaration probe', recoverable: false,
});
const packageName: string = packageJson.name;

void component;
void props;
void workbook;
void locales;
void exception;
void packageName;
