import assert from 'assert';
import { describe, it } from 'mocha';
import { formatm } from '../../src/core/format';

const gformats = formatm;
describe('format', () => {
  describe('#render()', () => {
    it('text: should return abc when the value is abc', () => {
      assert.equal(gformats.text.render('abc'), 'abc');
    });
    it('number: should return 11,000.20 when the value is 11000.20', () => {
      assert.equal(gformats.number.render('11000.20'), '11,000.20');
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
  });
});
