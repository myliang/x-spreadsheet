import assert from 'assert';
import { describe, it } from 'mocha';
import {
  locale,
  t,
  tf
} from '../../src/locale/locale';

// Add window global if it doesn't exist
// Some tests depend on this global variable's existence
if (typeof window === 'undefined') {
  global.window = {};
}

// Override messages that exist in the fallback locale
const localeTest1 = 'TEST_1';
const localeTest1Messages = {
	toolbar: {
		undo: 'Test 1 Undo',
		redo: 'Test 1 Redo',
	},
	formula: {
		"VAR\\.P": "Test 1 VARP"
	}
};

const localeTest2 = 'TEST_2';
const localeTest2Messages = {
	toolbar: {
		undo: 'Test 2 Undo',
    // Do not define "redo" message in locale test 2
	},
};

describe('locale', () => {
  describe('.t()', () => {
    it('should return an empty string when the value has no available translation', () => {
      assert.equal(t('something.not.defined'), '');
    });
    it('should return Undo when the value is toolbar.undo', () => {
      assert.equal(t('toolbar.undo'), 'Undo');
    });
  });
  describe('.tf()', () => {
    it('should return Undo when the value is toolbar.undo', () => {
      const functionWhichReturnsTranslatedValue = tf('toolbar.undo');
      assert.equal(functionWhichReturnsTranslatedValue(), 'Undo');
    });
  });
  describe('.locale()', () => {
  	// Must be the first test which calls the locale function,
  	// as it depends on the first locale in the language list to be unchanged
  	// from the default (English). Subsequent tests must clear the language
  	// list to work as intended (otherwise thet language list will grow with
  	// each test).
    it('should return Print when the value is toolbar.print and the fallback locale is English', () => {
      // Provides no value for toolbar.print, so the English fallback will be used
      locale(localeTest1, localeTest1Messages, false);
      assert.equal(t('toolbar.print'), 'Print');
    });
    it('should return Test 2 Undo when the value is toolbar.undo', () => {
      // Set language list to prioritize use of locale test 2, then locale test 1
      locale(localeTest1, localeTest1Messages, true);
      locale(localeTest2, localeTest2Messages, false);

      assert.equal(t('toolbar.undo'), 'Test 2 Undo');
    });
    it('should return Test 1 Redo when the value is toolbar.redo', () => {
      // Set language list to prioritize use of locale test 2, then locale test 1
      locale(localeTest1, localeTest1Messages, true);
      locale(localeTest2, localeTest2Messages, false);

      // locale test 2 doesn't have the toolbar.redo message defined
      assert.equal(t('toolbar.redo'), 'Test 1 Redo');
    });
  });
  describe('.t() [tests which depend on modified language list]', () => {
    it('should return Test 1 VARP when the value is toolbar.formula.VAR\\.P', () => {
      locale(localeTest1, localeTest1Messages, true);
      assert.equal(t('formula.VAR\\.P'), 'Test 1 VARP');
    });
    it('should return Test 1 Redo when the value is toolbar.redo and a fallback is specified on the window global', () => {
      // Only define locale test 2 messages here
      locale(localeTest2, localeTest2Messages, true);

      // Depends on existence of window global variable
      // Supply a fallback locale test 2 message dictionary (from locale test 1)
      window.x_spreadsheet = { $messages: {
        'TEST_2': localeTest1Messages
      }};

      assert.equal(t('toolbar.redo'), 'Test 1 Redo');
    });
  });
});
