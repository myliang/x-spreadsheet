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
    it('CONCAT: should return 1200USD when the value is [\'1200\', \'USD\']', () => {
      assert.equal(gformulas.CONCAT.render(['1200', 'USD']), '1200USD');
    });
  });
});
