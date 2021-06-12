// const = require('../../src/data/);
import assert from 'assert';
import { describe, it } from 'mocha';
import {
  indexAt,
  stringAt,
  expr2xy,
  expr2expr,
} from '../../src/core/alphabet';

describe('alphabet', () => {
  describe('.indexAt()', () => {
    it('should return 0 when the value is A', () => {
      assert.equal(indexAt('A'), 1 * 26 ** 0 - 1);
    });
    it('should return 27 when the value is AB', () => {
      assert.equal(indexAt('AB'), 1 * 26 ** 1 + 2 * 26 ** 0 - 1);
    });
    it('should return 730 when the value is ABC', () => {
      assert.equal(indexAt('ABC'), 1 * 26 ** 2 + 2 * 26 ** 1 + 3 * 26 ** 0 - 1);
    });
    it('should return 19009 when the value is ABCD', () => {
      assert.equal(indexAt('ABCD'), 1 * 26 ** 3 + 2 * 26 ** 2 + 3 * 26 ** 1 + 4 * 26 ** 0 - 1);
    });
  });
  describe('.stringAt()', () => {
    it('should return A when the value is 0', () => {
      assert.equal(stringAt(1 * 26 ** 0 - 1), 'A');
    });
    it('should return AB when the value is 27', () => {
      assert.equal(stringAt(1 * 26 ** 1 + 2 * 26 ** 0 - 1), 'AB');
    });
    it('should return ABC when the value is 730', () => {
      assert.equal(stringAt(1 * 26 ** 2 + 2 * 26 ** 1 + 3 * 26 ** 0 - 1), 'ABC');
    });
    it('should return ABCD when the value is 19009', () => {
      assert.equal(stringAt(1 * 26 ** 3 + 2 * 26 ** 2 + 3 * 26 ** 1 + 4 * 26 ** 0 - 1), 'ABCD');
    });
  });
  describe('.expr2xy()', () => {
    it('should return 0 when the value is A1', () => {
      assert.equal(expr2xy('A1')[0], 0);
      assert.equal(expr2xy('A1')[1], 0);
    });
  });
  describe('.expr2expr()', () => {
    it('should return B2 when the value is A1, 1, 1', () => {
      assert.equal(expr2expr('A1', 1, 1), 'B2');
    });
    it('should return C4 when the value is A1, 2, 3', () => {
      assert.equal(expr2expr('A1', 2, 3), 'C4');
    });
  });
});
