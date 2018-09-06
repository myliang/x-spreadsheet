import assert from 'assert';
import { describe, it } from 'mocha';
import { formats, baseFormats } from '../../src/data/format';

describe('formats()', () => {
  it('should return baseFormats.length formats when this value is empty', () => {
    assert.equal(Object.keys(formats()).length, baseFormats.length);
  });
  it('should return baseFormats.length + 1 formats when this value is [{key: "tahoma", title: "tahoma", render: () => {}}]', () => {
    const no = formats([{ key: 'tahoma', title: 'tahoma', render: () => {} }]);
    assert.equal(Object.keys(no).length, baseFormats.length + 1);
  });
  it('should return value include tohoma when this value is [{key: "tahoma", title: "tahoma", render: () => {}}]', () => {
    const no = formats([{ key: 'tahoma', title: 'tahoma', render: () => {} }]);
    assert.ok(Object.keys(no).includes('tahoma'));
  });
});

const gformats = formats();
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
      assert.equal(gformats.RMB.render('1200.333'), '￥1,200.33');
    });
    it('USD: should return $1,200.33 when the value is 1200.333', () => {
      assert.equal(gformats.USD.render('1200.333'), '$1,200.33');
    });
  });
});
