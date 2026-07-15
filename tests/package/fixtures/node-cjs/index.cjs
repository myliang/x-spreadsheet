const assert = require('node:assert/strict');
const { TegoSheet, TegoSheetException } = require('tego-sheet');
const packageJson = require('tego-sheet/package.json');
const { de } = require('tego-sheet/locales/de');
const { en } = require('tego-sheet/locales/en');
const { nl } = require('tego-sheet/locales/nl');
const { zhCN } = require('tego-sheet/locales/zh-cn');

assert.equal(typeof TegoSheet, 'object');
assert.equal(
  new TegoSheetException({ code: 'INVALID_COMMAND', message: 'probe', recoverable: false })
    instanceof TegoSheetException,
  true,
);
assert.equal(packageJson.name, 'tego-sheet');
assert.deepEqual([en.id, de.id, nl.id, zhCN.id], ['en', 'de', 'nl', 'zh-CN']);
