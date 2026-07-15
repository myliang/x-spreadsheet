import assert from 'node:assert/strict';
import { TegoSheet, TegoSheetException } from 'tego-sheet';
import packageJson from 'tego-sheet/package.json' with { type: 'json' };
import { de } from 'tego-sheet/locales/de';
import { en } from 'tego-sheet/locales/en';
import { nl } from 'tego-sheet/locales/nl';
import { zhCN } from 'tego-sheet/locales/zh-cn';

assert.equal(typeof TegoSheet, 'object');
assert.equal(
  new TegoSheetException({ code: 'INVALID_COMMAND', message: 'probe', recoverable: false })
    instanceof TegoSheetException,
  true,
);
assert.equal(packageJson.name, 'tego-sheet');
assert.deepEqual([en.id, de.id, nl.id, zhCN.id], ['en', 'de', 'nl', 'zh-CN']);
