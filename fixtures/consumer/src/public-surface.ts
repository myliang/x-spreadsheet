import { TegoSheetException, type LocaleDefinition } from 'tego-sheet';
import { de } from 'tego-sheet/locales/de';
import { en } from 'tego-sheet/locales/en';
import { nl } from 'tego-sheet/locales/nl';
import { zhCN } from 'tego-sheet/locales/zh-cn';

const locales: readonly LocaleDefinition[] = [en, de, nl, zhCN];
const exception = new TegoSheetException({
  code: 'INVALID_COMMAND',
  message: 'Consumer type probe',
  recoverable: false,
});

void locales;
void exception;
