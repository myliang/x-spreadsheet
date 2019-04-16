import assert from 'assert';
import { describe, it } from 'mocha';
import { CellRange } from '../../src/core/cell_range';

describe('CellRange', () => {
  describe('#constructor()', () => {
    it('should return { sri: 1, sci: 2, eri: 3, eci: 4, w: 0, h: 0 } when new CellRange(1,2,3,4)', () => {
      const cr = new CellRange(1, 2, 3, 4);
      assert.equal(cr.sri, 1);
      assert.equal(cr.sci, 2);
      assert.equal(cr.eri, 3);
      assert.equal(cr.eci, 4);
      assert.equal(cr.w, 0);
      assert.equal(cr.h, 0);
    });
    it('should return { sri: 1, sci: 2, eri: 3, eci: 4, w: 5, h: 6 } when new CellRange(1,2,3,4, 5, 6)', () => {
      const cr = new CellRange(1, 2, 3, 4, 5, 6);
      assert.equal(cr.sri, 1);
      assert.equal(cr.sci, 2);
      assert.equal(cr.eri, 3);
      assert.equal(cr.eci, 4);
      assert.equal(cr.w, 5);
      assert.equal(cr.h, 6);
    });
  });
  
  describe('#set()', () => {
    it('should return { sri: 1, sci: 2, eri: 3, eci: 4 } when set(1, 2, 3, 4)', () => {
      const cr = new CellRange(0, 0, 0, 0);
      cr.set(1, 2, 3, 4);
      assert.equal(cr.sri, 1);
      assert.equal(cr.sci, 2);
      assert.equal(cr.eri, 3);
      assert.equal(cr.eci, 4);
    });
  });

  describe('#multiple()', () => {
    it('should return true when new CellRange(1, 2, 1, 3)', () => {
      const cr = new CellRange(1, 2, 1, 3);
      assert.ok(cr.multiple());
    });
    it('should return true when new CellRange(1, 1, 2, 1)', () => {
      const cr = new CellRange(1, 1, 2, 1);
      assert.ok(cr.multiple());
    });
    it('should return false when new CellRange(1, 1, 1, 1)', () => {
      const cr = new CellRange(1, 1, 1, 1);
      assert.equal(false, cr.multiple());
    });
  });

  describe('#includes()', () => {
    it('should return true when the value is A10', () => {
      const cr = new CellRange(0, 0, 9, 1);
      assert.ok(cr.includes('A10'));
    });
    it('should return true when the value is 0, 1', () => {
      const cr = new CellRange(0, 0, 9, 1);
      assert.ok(cr.includes(0, 1));
    });
    it('should return false when the value is A11', () => {
      const cr = new CellRange(0, 0, 9, 1);
      assert.equal(false, cr.includes('A11'));
    });
    it('should return false when the value is A1', () => {
      const cr = new CellRange(0, 0, 9, 1);
      assert.equal(false, cr.includes('A11'));
    });
  });

  describe('#contains()', () => {
    it('should return true when the value is {sri: 2, sci: 2, eri: 2, eci: 2}', () => {
      const cr = new CellRange(0, 0, 5, 5);
      const other = new CellRange(2, 2, 2, 2);
      assert.ok(cr.contains(other));
    });
    it('should return true when the value is {sri: 5, sci: 5, eri: 5, eci: 5}', () => {
      const cr = new CellRange(0, 0, 5, 5);
      const other = new CellRange(5, 5, 5, 5);
      assert.ok(cr.contains(other));
    });
    it('should return false when the value is {sri: 5, sci: 6, eri: 5, eci: 6}', () => {
      const cr = new CellRange(0, 0, 5, 5);
      const other = new CellRange(5, 6, 5, 6);
      assert.equal(false, cr.contains(other));
    });
    it('should return true when the value is {sri: 1, sci: 1, eri: 3, eci: 3}', () => {
      const cr = new CellRange(2, 2, 5, 5);
      const other = new CellRange(1, 1, 3, 3);
      assert.equal(false, cr.contains(other));
    });
  });

  describe('#within()', () => {
    it('should return false when the value is {sri: 2, sci: 2, eri: 2, eci: 2}', () => {
      const cr = new CellRange(0, 0, 5, 5);
      const other = new CellRange(2, 2, 2, 2);
      assert.equal(false, cr.within(other));
    });
    it('should return false when the value is {sri: 1, sci: 1, eri: 1, eci: 6}', () => {
      const cr = new CellRange(1, 1, 1, 6);
      const other = new CellRange(2, 2, 5, 5);
      assert.equal(false, cr.within(other));
    });
    it('should return false when the value is {sri: 6, sci: 3, eri: 6, eci: 4}', () => {
      const cr = new CellRange(6, 3, 6, 4);
      const other = new CellRange(2, 2, 5, 5);
      assert.equal(false, cr.within(other));
    });
    it('should return true when the value is {sri: 2, sci: 2, eri: 5, eci: 5}', () => {
      const cr = new CellRange(2, 2, 2, 2);
      const other = new CellRange(2, 2, 5, 5);
      assert.ok(cr.within(other));
    });
  });

  describe('#disjoint()', () => {
    it('should return true when the value is {sri: 2, sci: 2, eri: 2, eci: 2}', () => {
      const cr = new CellRange(4, 4, 6, 8);
      const other = new CellRange(2, 2, 2, 2);
      assert.ok(cr.disjoint(other));
    });
    it('should return true when the value is {sri: 2, sci: 2, eri: 3, eci: 2}', () => {
      const cr = new CellRange(4, 4, 6, 8);
      const other = new CellRange(2, 2, 3, 2);
      assert.ok(cr.disjoint(other));
    });
    it('should return false when the value is {sri: 4, sci: 4, eri: 4, eci: 4}', () => {
      const cr = new CellRange(4, 4, 6, 8);
      const other = new CellRange(4, 4, 4, 4);
      assert.equal(false, cr.disjoint(other));
    });
    it('should return false when the value is {sri: 5, sci: 2, eri: 5, eci: 9}', () => {
      const cr = new CellRange(4, 4, 6, 8);
      const other = new CellRange(5, 2, 5, 9);
      assert.equal(false, cr.disjoint(other));
    });
  });

  describe('#intersects()', () => {
    // contains
    it('should return true when the value is {sri: 5, sci: 5, eri: 5, eci: 5}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(5, 5, 5, 5);
      assert.ok(cr.intersects(other));
    });
    // cross 1
    it('should return true when the value is {sri: 4, sci: 2, eri: 4, eci: 9}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(4, 2, 4, 9);
      assert.ok(cr.intersects(other));
    });
    // cross 2
    it('should return true when the value is {sri: 2, sci: 4, eri: 9, eci: 4}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(2, 4, 9, 4);
      assert.ok(cr.intersects(other));
    });
    // overlap top
    it('should return true when the value is {sri: 1, sci: 5, eri: 3, eci: 9}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(1, 5, 3, 9);
      assert.ok(cr.intersects(other));
    });
    // overlap bottom
    it('should return true when the value is {sri: 8, sci: 5, eri: 10, eci: 9}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(8, 5, 10, 9);
      assert.ok(cr.intersects(other));
    });
    // overlap left
    it('should return true when the value is {sri: 3, sci: 1, eri: 4, eci: 5}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(3, 1, 4, 5);
      assert.ok(cr.intersects(other));
    });
    // overlap right
    it('should return true when the value is {sri: 8, sci: 5, eri: 10, eci: 9}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(3, 8, 4, 10);
      assert.ok(cr.intersects(other));
    });
    // left top
    it('should return true when the value is {sri: 3, sci: 3, eri: 3, eci: 3}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(3, 3, 3, 3);
      assert.ok(cr.intersects(other));
    });
    // left bottom
    it('should return true when the value is {sri: 8, sci: 3, eri: 8, eci: 3}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(8, 3, 8, 3);
      assert.ok(cr.intersects(other));
    });
    // right top
    it('should return true when the value is {sri: 3, sci: 8, eri: 3, eci: 8}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(3, 8, 3, 8);
      assert.ok(cr.intersects(other));
    });
    // right bottom
    it('should return true when the value is {sri: 8, sci: 8, eri: 8, eci: 8}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(8, 8, 8, 8);
      assert.ok(cr.intersects(other));
    });
    // test for false
    // top false
    it('should return false when the value is {sri: 2, sci: 4, eri: 2, eci: 7}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(2, 4, 2, 7);
      assert.equal(false, cr.intersects(other));
    });
    // bottom false
    it('should return false when the value is {sri: 9, sci: 4, eri: 9, eci: 7}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(9, 4, 9, 7);
      assert.equal(false, cr.intersects(other));
    });
    // left false
    it('should return false when the value is {sri: 4, sci: 1, eri: 4, eci: 2}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(4, 1, 4, 2);
      assert.equal(false, cr.intersects(other));
    });
    // right false
    it('should return false when the value is {sri: 4, sci: 9, eri: 4, eci: 10}', () => {
      const cr = new CellRange(3, 3, 8, 8);
      const other = new CellRange(4, 9, 4, 10);
      assert.equal(false, cr.intersects(other));
    });
  });

  describe('#union()',  () => {
    it('should return {1,1,5,5} when the value is {3,3,5,5}', () => {
      const cr = new CellRange(1, 1, 3, 3);
      const other = new CellRange(3, 3, 5, 5);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
    // top
    it('should return {1,1,5,5} when the value is {1,3,2,3}', () => {
      const cr = new CellRange(2, 1, 5, 5);
      const other = new CellRange(1, 3, 2, 3);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
    // top right
    it('should return {1,1,5,7} when the value is {1,3,2,7}', () => {
      const cr = new CellRange(2, 1, 5, 5);
      const other = new CellRange(1, 3, 2, 7);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 7);
    });
    // top left
    it('should return {1,0,5,5} when the value is {1,0,2,3}', () => {
      const cr = new CellRange(2, 1, 5, 5);
      const other = new CellRange(1, 0, 2, 3);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 0);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
    // bottom
    it('should return {1,1,5,5} when the value is {3,2,5,2}', () => {
      const cr = new CellRange(1, 1, 3, 5);
      const other = new CellRange(3, 2, 5, 2);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
    // bottom right
    it('should return {1,1,5,7} when the value is {3,2,5,7}', () => {
      const cr = new CellRange(1, 1, 3, 5);
      const other = new CellRange(3, 2, 5, 7);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 7);
    });
    // bottom left
    it('should return {1,0,5,5} when the value is {3,0,5,2}', () => {
      const cr = new CellRange(1, 1, 3, 5);
      const other = new CellRange(3, 0, 5, 2);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 0);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
    // left
    it('should return {1,1,5,5} when the value is {3,1,3,2}', () => {
      const cr = new CellRange(1, 2, 5, 5);
      const other = new CellRange(3, 1, 3, 2);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
    // left top
    it('should return {1,1,5,5} when the value is {1,1,3,2}', () => {
      const cr = new CellRange(2, 2, 5, 5);
      const other = new CellRange(1, 1, 3, 2);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
    // left bottom
    it('should return {1,1,7,5} when the value is {3,1,7,1}', () => {
      const cr = new CellRange(1, 1, 5, 5);
      const other = new CellRange(3, 1, 7, 1);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 7);
      assert.equal(ret.eci, 5);
    });
    // right
    it('should return {1,1,5,5} when the value is {2,4,3,5}', () => {
      const cr = new CellRange(1, 1, 5, 3);
      const other = new CellRange(2, 4, 3, 5);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
    // right top
    it('should return {1,1,5,5} when the value is {1,4,3,5}', () => {
      const cr = new CellRange(2, 1, 5, 3);
      const other = new CellRange(1, 4, 3, 5);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
    // right bottom
    it('should return {1,1,5,5} when the value is {1,4,5,5}', () => {
      const cr = new CellRange(1, 1, 3, 3);
      const other = new CellRange(1, 4, 5, 5);
      const ret = cr.union(other);
      assert.equal(ret.sri, 1);
      assert.equal(ret.sci, 1);
      assert.equal(ret.eri, 5);
      assert.equal(ret.eci, 5);
    });
  });

});

