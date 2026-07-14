import assert from 'assert';
import { describe, it } from 'mocha';
import helper from '../src/core/helper';

describe('helper', () => {
  describe('.cloneDeep()', () => {
    it('The modification of the returned value does not affect the original value', () => {
      const obj = { k: { k1: 'v' } };
      const obj1 = helper.cloneDeep(obj);
      obj1.k.k1 = 'v1';
      assert.equal(obj.k.k1, 'v');
    });
  });
  describe('.merge()', () => {
    it('should return { a: \'a\' } where the value is { a: \'a\' }', () => {
      const merge = helper.merge({ a: 'a' });
      assert.equal(merge.a, 'a');
    });
    it('should return {a: \'a\', b: \'b\'} where the value is {a: \'a\'}, {b: \'b\'}', () => {
      const merge = helper.merge({ a: 'a' }, { b: 'b' });
      assert.equal(merge.a, 'a');
      assert.equal(merge.b, 'b');
    });
    it('should return { a: { a1: \'a2\' }, b: \'b\' } where the value is {a: {a1: \'a1\'}, b: \'b\'}, {a: {a1: \'b\'}}', () => {
      const obj = { a: { a1: 'a1' }, b: 'b' };
      const merge = helper.merge(obj, { a: { a1: 'a2' } });
      assert.equal(obj.a.a1, 'a1');
      assert.equal(merge.a.a1, 'a2');
      assert.equal(merge.b, 'b');
    });
  });
  // sum
  describe('.sum()', () => {
    it('should return [50, 3] where the value is [10, 20, 20]', () => {
      const [total, size] = helper.sum([10, 20, 20]);
      assert.equal(total, 50);
      assert.equal(size, 3);
    });
    it('should return [50, 3] where the value is {k1: 10, k2: 20, k3: 20}', () => {
      const [total, size] = helper.sum({ k1: 10, k2: 20, k3: 20 });
      assert.equal(total, 50);
      assert.equal(size, 3);
    });
  });
});
