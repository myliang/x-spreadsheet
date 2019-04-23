import { CellRange } from './cell_range';
// operator: eq|neq|gt|gte|lt|lte|in|be
// value:
//   in => []
//   be => [min, max]
/* eslint-disable */
class Filter {
  constructor(ci, operator, value) {
    this.ci = ci;
    this.operator = operator;
    this.value = value;
  }
}

class Sort {
  constructor(ci, desc) {
    this.ci = ci;
    this.desc = desc;
  }
}

export default class AutoFilter {
  constructor() {
    this.ref = null;
    this.filters = [];
    this.sort = null;
  }

  contains(ri, ci) {
    if (this.active()) {
      return this.hrange().includes(ri, ci);
    }
    return false;
  }

  range() {
    return CellRange.valueOf(this.ref);
  }

  hrange() {
    const r = this.range();
    r.eri = r.sri;
    return r;
  }

  clear() {
    this.ref = null;
    this.filters = [];
    this.sort = null;
  }

  active() {
    return this.ref !== null;
  }
}
