import assert from 'assert';
import { describe, it } from 'mocha';
import {
  formatm,
  baseFormats,
} from '../../src/core/format';

const gformats = formatm;
describe('formatm', () => {
  describe('#render()', () => {
    it('normal: should return AC when the value is AC', () => {
      assert.equal(gformats.normal.render('AC'), 'AC');
    });
    it('text: should return abc when the value is abc', () => {
      assert.equal(gformats.text.render('abc'), 'abc');
    });
    it('number: should return 11,000.20 when the value is 11000.20', () => {
      assert.equal(gformats.number.render('11000.20'), '11,000.20');
    });
    it('number: should return 110,00.20 (NOT MODIFIED when encounter ileagal input) when the value is 110,00.20', () => {
      assert.equal(gformats.number.render('110,00.20'), '110,00.20');
    });
    it('percent: should return 50.456% when the value is 50.456', () => {
      assert.equal(gformats.percent.render('50.456'), '50.456%');
    });
    it('RMB: should return ￥1,200.33 when the value is 1200.333', () => {
      assert.equal(gformats.rmb.render('1200.333'), '￥1,200.33');
    });
    it('USD: should return $1,200.33 when the value is 1200.333', () => {
      assert.equal(gformats.usd.render('1200.333'), '$1,200.33');
    });
    it('EUR: should return €1,200.33 when the value is 1200.333', () => {
      assert.equal(gformats.eur.render('1200.333'), '€1,200.33');
    });
  });
});

describe('baseFormats', () => {
  // item.key
  it('typeof item.key should be "string"',
    () => {
      const KEY = 'key';
      assert.equal(baseFormats.find(i => typeof i[KEY] !== 'string'), undefined);
    });
  // item.title
  it('typeof item.title should be "function"',
    () => {
      const KEY = 'title';
      assert.equal(baseFormats.find(i => typeof i[KEY] !== 'function'), undefined);
    });
  // item.type
  it('typeof item.type should be "string"',
    () => {
      const KEY = 'type';
      assert.equal(baseFormats.find(i => typeof i[KEY] !== 'string'), undefined);
    });
  // item.render
  it('typeof item.render should be "function"',
    () => {
      const KEY = 'render';
      assert.equal(baseFormats.find(i => typeof i[KEY] !== 'function'), undefined);
    });
  // item.label
  it('typeof item.label should be "string" or "undefined"',
    () => {
      const KEY = 'label';
      assert.equal(baseFormats.find(i => typeof i[KEY] !== 'string' && typeof i[KEY] !== 'undefined'), undefined);
    });
});
