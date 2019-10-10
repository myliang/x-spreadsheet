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
      assert.equal(indexAt('A'), 0);
    });
    it('should return 25 when the value is Z', () => {
      assert.equal(indexAt('Z'), 25);
    });
    it('should return 26 when the value is AA', () => {
      assert.equal(indexAt('AA'), 26);
    });
    it('should return 52 when the value is BA', () => {
      assert.equal(indexAt('BA'), 52);
    });
    it('should return 54 when the value is BC', () => {
      assert.equal(indexAt('BC'), 54);
    });
    it('should return 78 when the value is CA', () => {
      assert.equal(indexAt('CA'), 78);
    });
    it('should return 26 * 26 when the value is ZA', () => {
      assert.equal(indexAt('ZA'), 26 * 26);
    });
    it('should return 26 * 26 + 26 when the value is AAA', () => {
      assert.equal(indexAt('AAA'), (26 * 26) + 26);
    });
  });
  describe('.stringAt()', () => {
    it('should return A when the value is 0', () => {
      assert.equal(stringAt(0), 'A');
    });
    it('should return Z when the value is 25', () => {
      assert.equal(stringAt(25), 'Z');
    });
    it('should return AA when the value is 26', () => {
      assert.equal(stringAt(26), 'AA');
    });
    it('should return BC when the value is 54', () => {
      assert.equal(stringAt(54), 'BC');
    });
    it('should return CB when the value is 78', () => {
      assert.equal(stringAt(78), 'CA');
    });
    it('should return ZA when the value is 26 * 26', () => {
      assert.equal(stringAt(26 * 26), 'ZA');
    });
    it('should return Z when the value is 26 * 26 + 1', () => {
      assert.equal(stringAt((26 * 26) + 1), 'ZB');
    });
    it('should return AAA when the value is 26 * 26 + 26', () => {
      assert.equal(stringAt((26 * 26) + 26), 'AAA');
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
