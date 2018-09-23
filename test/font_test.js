import assert from 'assert';
import { describe, it } from 'mocha';
import { fonts, baseFonts } from '../src/font';

describe('fonts()', () => {
  it('should return baseFonts.length fonts when this value is empty', () => {
    assert.equal(Object.keys(fonts()).length, baseFonts.length);
  });
  it('should return baseFonts.length + 1 fonts when this value is [{key: "tahoma", title: "tahoma"}]', () => {
    const nfonts = fonts([{ key: 'tahoma', title: 'tahoma' }]);
    assert.equal(Object.keys(nfonts).length, baseFonts.length + 1);
  });
  it('should return value include tohoma when this value is [{key: "tahoma", title: "tahoma"}]', () => {
    const nfonts = fonts([{ key: 'tahoma', title: 'tahoma' }]);
    assert.ok(Object.keys(nfonts).includes('tahoma'));
  });
});
