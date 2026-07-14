import assert from 'assert';
import { describe, it } from 'mocha';
import { formulam } from '../../src/core/formula';

const gformulas = formulam;
describe('formula', () => {
  describe('#render()', () => {
    it('SUM: should return 36 when the value is [\'12\', \'12\', 12]', () => {
      assert.equal(gformulas.SUM.render(['12', '12', 12]), 36);
    });
    it('AVERAGE: should return 13 when the value is [\'12\', \'13\', 14]', () => {
      assert.equal(gformulas.AVERAGE.render(['12', '13', 14]), 13);
    });
    it('MAX: should return 14 when the value is [\'12\', \'13\', 14]', () => {
      assert.equal(gformulas.MAX.render(['12', '13', 14]), 14);
    });
    it('MIN: should return 12 when the value is [\'12\', \'13\', 14]', () => {
      assert.equal(gformulas.MIN.render(['12', '13', 14]), 12);
    });
    it('IF: should return 12 when the value is [12 > 11, 12, 11]', () => {
      assert.equal(gformulas.IF.render([12 > 11, 12, 11]), 12);
    });
    it('AND: should return true when the value is ["a", true, "ok"]', () => {
      assert.equal(gformulas.AND.render(['a', true, 'ok']), true);
    });
    it('AND: should return false when the value is ["a", false, "ok"]', () => {
      assert.equal(gformulas.AND.render(['a', false, 'ok']), false);
    });
    it('OR: should return true when the value is ["a", true]', () => {
      assert.equal(gformulas.OR.render(['a', true]), true);
    });
    it('OR: should return true when the value is ["a", false]', () => {
      assert.equal(gformulas.OR.render(['a', false]), true);
    });
    it('OR: should return false when the value is [0, false]', () => {
      assert.equal(gformulas.OR.render([0, false]), false);
    });
    it('CONCAT: should return 1200USD when the value is [\'1200\', \'USD\']', () => {
      assert.equal(gformulas.CONCAT.render(['1200', 'USD']), '1200USD');
    });
  });
});
