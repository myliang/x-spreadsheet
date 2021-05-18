// const = require('../../src/data/);
import assert from 'assert';
import { describe, it } from 'mocha';
import {
  indexAt,
  stringAt,
  xy2expr,
  expr2xy,
  expr2expr,
  expr2cellRangeArgs,
  cellRangeArgs2expr,
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
  describe('.xy2expr()', () => {
    it('should return B4 when the value is 1,3 and X/Y are relative', () => {
      assert.equal(xy2expr(1, 3), 'B4');
    });
    it('should return $B4 when the value is 1,3 and X is absolute', () => {
      assert.equal(xy2expr(1, 3, true, false), '$B4');
    });
    it('should return B$4 when the value is 1,3 and Y is absolute', () => {
      assert.equal(xy2expr(1, 3, false, true), 'B$4');
    });
    it('should return B$4$ when the value is 1,3 and X/Y are absolute', () => {
      assert.equal(xy2expr(1, 3, true, true), '$B$4');
    });
  });
  describe('.expr2xy()', () => {
    it('should return 0 when the value is A1', () => {
      const expr = 'A1';
      const ret = expr2xy(expr);
      assert.equal(ret[0], 0);
      assert.equal(ret[1], 0);
      assert.equal(ret[2], false);
      assert.equal(ret[3], false);
      assert.equal(ret[4], expr.length);
    });
    it('should return 1,3 when the value is B4', () => {
      const expr = 'B4';
      const ret = expr2xy(expr);
      assert.equal(ret[0], 1);
      assert.equal(ret[1], 3);
      assert.equal(ret[2], false);
      assert.equal(ret[3], false);
      assert.equal(ret[4], expr.length);
    });
    it('should return that X is absolute when the value is $B4', () => {
      const expr = '$B4';
      const ret = expr2xy(expr);
      assert.equal(ret[0], 1);
      assert.equal(ret[1], 3);
      assert.equal(ret[2], true);
      assert.equal(ret[3], false);
      assert.equal(ret[4], expr.length);
    });
    it('should return that Y is absolute when the value is $B4', () => {
      const expr = 'B$4';
      const ret = expr2xy(expr);
      assert.equal(ret[0], 1);
      assert.equal(ret[1], 3);
      assert.equal(ret[2], false);
      assert.equal(ret[3], true);
      assert.equal(ret[4], expr.length);
    });
    it('should return that X and Y are absolute when the value is $B$4', () => {
      const expr = '$B$4';
      const ret = expr2xy(expr);
      assert.equal(ret[0], 1);
      assert.equal(ret[1], 3);
      assert.equal(ret[2], true);
      assert.equal(ret[3], true);
      assert.equal(ret[4], expr.length);
    });
    // Note: defined REGEX currently supports up to ZZZ (3 letters max)
    it('should return 27,999 when the value is $ABC$1000', () => {
      const expr = '$ABC$1000';
      const ret = expr2xy(expr);
      assert.equal(ret[0], 1 * 26 ** 2 + 2 * 26 ** 1 + 3 * 26 ** 0 - 1);
      assert.equal(ret[1], 999);
      assert.equal(ret[2], true);
      assert.equal(ret[3], true);
      assert.equal(ret[4], expr.length);
    });
    it('should return 1,29 when the value is B$30:B$335', () => {
      const expr = 'B$30:B$335';
      const ret = expr2xy(expr);
      assert.equal(ret[0], 1);
      assert.equal(ret[1], 29);
      assert.equal(ret[2], false);
      assert.equal(ret[3], true);
      assert.equal(ret[4], 'B$30'.length);
    });
  });
  describe('.expr2expr()', () => {
    it('should return B2 when the value is A1, 1, 1', () => {
      assert.equal(expr2expr('A1', 1, 1), 'B2');
    });
    it('should return C4 when the value is A1, 2, 3', () => {
      assert.equal(expr2expr('A1', 2, 3), 'C4');
    });
    // Use of the optional condition function argument
    it('should return A1 when the value is A1, 1, 1, false, () => false', () => {
      assert.equal(expr2expr('A1', 1, 1, false, () => false), 'A1');
    });
    // Start of absolute cell reference cases
    it('should return $A2 when the value is $A1, 1, 1', () => {
      assert.equal(expr2expr('$A1', 1, 1), '$A2');
    });
    it('should return B$1 when the value is A$1, 1, 1', () => {
      assert.equal(expr2expr('A$1', 1, 1), 'B$1');
    });
    it('should return $A$A when the value is $A$1, 1, 1', () => {
      assert.equal(expr2expr('$A$1', 1, 1), '$A$1');
    });
    it('should return $B2 when the value is $A1, 1, 1, true', () => {
      assert.equal(expr2expr('$A1', 1, 1, true), '$B2');
    });
    it('should return B$2 when the value is A$1, 1, 1, true', () => {
      assert.equal(expr2expr('A$1', 1, 1, true), 'B$2');
    });
    it('should return $B$2 when the value is $A$1, 1, 1, true', () => {
      assert.equal(expr2expr('$A$1', 1, 1, true), '$B$2');
    });
  });
  describe('.expr2cellRangeArgs()', () => {
    it('should return null when the value is empty', () => {
      assert.equal(expr2cellRangeArgs(''), null);
    });
    it('should return null when the value is A', () => {
      assert.equal(expr2cellRangeArgs('A'), null);
    });
    it('should return null when the value is 1', () => {
      assert.equal(expr2cellRangeArgs('1'), null);
    });
    it('should return 0,0,0,0 when the value is A1', () => {
      assert.deepEqual(expr2cellRangeArgs('A1'), [0, 0, 0, 0]);
    });
    // Single cell
    it('should return 3,1,3,1 when the value is B4', () => {
      assert.deepEqual(expr2cellRangeArgs('B4'), [3, 1, 3, 1]);
    });
    // Single cell with absolute references
    it('should return 3,1,3,1 when the value is $B4', () => {
      assert.deepEqual(expr2cellRangeArgs('$B4'), [3, 1, 3, 1]);
    });
    it('should return 3,1,3,1 when the value is B$4', () => {
      assert.deepEqual(expr2cellRangeArgs('B$4'), [3, 1, 3, 1]);
    });
    it('should return 3,1,3,1 when the value is $B$4', () => {
      assert.deepEqual(expr2cellRangeArgs('$B$4'), [3, 1, 3, 1]);
    });
    // Cell range
    it('should return 3,1,3,1 when the value is B4:C6', () => {
      assert.deepEqual(expr2cellRangeArgs('B4:C6'), [3, 1, 5, 2]);
    });
    it('should return 3,1,3,1 when the value is $B4:C$6', () => {
      assert.deepEqual(expr2cellRangeArgs('$B4:C$6'), [3, 1, 5, 2]);
    });
  });
  describe('.cellRangeArgs2expr()', () => {
    // Single cell
    it('should return B4 when the value is 3,1,3,1', () => {
      assert.equal(cellRangeArgs2expr(3, 1, 3, 1), 'B4');
    });
    // Cell range
    it('should return B4 when the value is 3,1,5,2', () => {
      assert.equal(cellRangeArgs2expr(3, 1, 5, 2), 'B4:C6');
    });
  });
});
