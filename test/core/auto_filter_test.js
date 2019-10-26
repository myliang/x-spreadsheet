import assert from 'assert';
import { describe, it } from 'mocha';
import AutoFilter from '../../src/core/auto_filter';

describe('AutoFilter', () => {
  describe('#constructor()', () => {
    const filter = new AutoFilter();
    it('this.ref == null', () => {
      assert(`${filter.ref}`, 'null');
    });
    it('this.filters == []', () => {
      assert(filter.filters, []);
    });
    it('this.sort == null', () => {
      assert(`${filter.sort}`, 'null');
    });
  });
});
