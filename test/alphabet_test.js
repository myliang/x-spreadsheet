// const alphabet = require('../../src/data/alphabet');
import assert from 'assert';
import { describe, it } from 'mocha';
import alphabet from '../src/alphabet';

describe('alphabet', () => {
  describe('.indexAt()', () => {
    it('should return 0 when the value is A', () => {
      assert.equal(alphabet.indexAt('A'), 0);
    });
    it('should return 25 when the value is Z', () => {
      assert.equal(alphabet.indexAt('Z'), 25);
    });
    it('should return 26 when the value is AA', () => {
      assert.equal(alphabet.indexAt('AA'), 26);
    });
    it('should return 52 when the value is BA', () => {
      assert.equal(alphabet.indexAt('BA'), 52);
    });
    it('should return 54 when the value is BC', () => {
      assert.equal(alphabet.indexAt('BC'), 54);
    });
    it('should return 78 when the value is CA', () => {
      assert.equal(alphabet.indexAt('CA'), 78);
    });
    it('should return 26 * 26 when the value is ZA', () => {
      assert.equal(alphabet.indexAt('ZA'), 26 * 26);
    });
    it('should return 26 * 26 + 26 when the value is AAA', () => {
      assert.equal(alphabet.indexAt('AAA'), (26 * 26) + 26);
    });
  });
  describe('.stringAt()', () => {
    it('should return A when the value is 0', () => {
      assert.equal(alphabet.stringAt(0), 'A');
    });
    it('should return Z when the value is 25', () => {
      assert.equal(alphabet.stringAt(25), 'Z');
    });
    it('should return AA when the value is 26', () => {
      assert.equal(alphabet.stringAt(26), 'AA');
    });
    it('should return BC when the value is 54', () => {
      assert.equal(alphabet.stringAt(54), 'BC');
    });
    it('should return CB when the value is 78', () => {
      assert.equal(alphabet.stringAt(78), 'CA');
    });
    it('should return ZA when the value is 26 * 26', () => {
      assert.equal(alphabet.stringAt(26 * 26), 'ZA');
    });
    it('should return Z when the value is 26 * 26 + 1', () => {
      assert.equal(alphabet.stringAt((26 * 26) + 1), 'ZB');
    });
    it('should return AAA when the value is 26 * 26 + 26', () => {
      assert.equal(alphabet.stringAt((26 * 26) + 26), 'AAA');
    });
  });
});
