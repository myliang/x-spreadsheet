import assert from 'assert';
import { describe, it } from 'mocha';
import {
  fontSizes,
  fonts,
  baseFonts,
  getFontSizePxByPt,
} from '../../src/core/font';

describe('baseFonts', () => {
  it('should be Array of "{ key: string, key: string }"', () => {
    const result = baseFonts.find((i) => {
      const keyType = typeof i.key;
      const titleType = typeof i.title;
      return keyType !== 'string' || titleType !== 'string';
    });
    assert.equal(result, undefined);
  });
});

describe('fontSizes', () => {
  it('should be Array of "{ pt: number, px: number }"', () => {
    const result = fontSizes.find((i) => {
      const ptType = typeof i.pt;
      const pxType = typeof i.px;
      return ptType !== 'number' || pxType !== 'number';
    });
    assert.equal(result, undefined);
  });
});

describe('getFontSizePxByPt()', () => {
  const fontsizeItem = { pt: 7.5, px: 10 };
  // not include pt
  const notIncludePT = 6.5;

  it(`should be return ${fontsizeItem.px} when the value is ${fontsizeItem.pt}`, () => {
    assert.equal(getFontSizePxByPt(fontsizeItem.pt), fontsizeItem.px);
  });
  it(`should be return ${notIncludePT} when the value is ${notIncludePT} (same as input arg)`, () => {
    assert.equal(getFontSizePxByPt(notIncludePT), notIncludePT);
  });
});

describe('fonts()', () => {
  const fontItem = baseFonts[0];
  it(`should include { ${fontItem.key}: ${JSON.stringify(fontItem)} } when the value is not provide.`, () => {
    const f = fonts();
    assert.equal(f[fontItem.key], fontItem);
  });

  /** @type {BaseFont} */
  const appendItem = [{
    key: 'test',
    title: 'test title',
  }];
  const appendItems = [appendItem];
  it(`should include { ${appendItems[0].key}: ${JSON.stringify(appendItems[0])} } when the value is ${JSON.stringify(appendItems)}`, () => {
    const f = fonts(appendItems);
    assert.equal(f[appendItem.key], appendItem);
  });
});
