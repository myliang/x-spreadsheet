import { CellRange } from './cell_range';
import { t } from '../locale/locale';
// operator: all|eq|neq|gt|gte|lt|lte|in|be
// value:
//   in => []
//   be => [min, max]
class Filter {
  constructor(ci, operator, value) {
    this.ci = ci;
    this.operator = operator;
    this.value = value;
  }

  set(operator, value) {
    this.operator = operator;
    this.value = value;
  }

  includes(v) {
    const { operator, value } = this;
    if (operator === 'all') {
      return true;
    }
    if (operator === 'in') {
      return value.includes(v);
    }
    return false;
  }

  vlength() {
    const { operator, value } = this;
    if (operator === 'in') {
      return value.length;
    }
    return 0;
  }

  getData() {
    const { ci, operator, value } = this;
    return { ci, operator, value };
  }
}

class Sort {
  constructor(ci, order) {
    this.ci = ci;
    this.order = order;
  }

  asc() {
    return this.order === 'asc';
  }

  desc() {
    return this.order === 'desc';
  }
}

export default class AutoFilter {
  constructor() {
    this.ref = null;
    this.filters = [];
    this.sort = null;
  }

  setData({ ref, filters, sort }) {
    // clear the filter if there's no reference
    if (!ref) {
      this.clear();
      return false;
    }
    this.ref = ref;
    this.filters = filters ? filters.map(it => new Filter(it.ci, it.operator, it.value)) : [];
    if (sort) {
      this.sort = new Sort(sort.ci, sort.order);
    }
    return true;
  }

  getData() {
    if (this.active()) {
      const { ref, filters, sort } = this;
      return { ref, filters: filters.map(it => it.getData()), sort };
    }
    return { ref: null, filters: [], sort: null };
  }

  addFilter(ci, operator, value) {
    const filter = this.getFilter(ci);
    if (filter === null) {
      this.filters.push(new Filter(ci, operator, value));
    } else {
      filter.set(operator, value);
    }
  }

  setSort(ci, order) {
    this.sort = order ? new Sort(ci, order) : null;
  }

  includes(ri, ci) {
    if (this.active()) {
      return this.hrange().includes(ri, ci);
    }
    return false;
  }

  getSort(ci) {
    const { sort } = this;
    if (sort && sort.ci === ci) {
      return sort;
    }
    return null;
  }

  getFilter(ci) {
    const { filters } = this;
    for (let i = 0; i < filters.length; i += 1) {
      if (filters[i].ci === ci) {
        return filters[i];
      }
    }
    return null;
  }

  // operator insert | delete
  move(ref, ri, n = 1, operator = 'insert') {
    if (!ref) {
      return false;
    }

    const oldRef = this.ref;
    const newRef = CellRange.valueOf(ref);

    if (operator === 'insert') {
      if (ri <= newRef.sri) {
        newRef.sri += n;
      }

      if (ri <= newRef.eri) {
        newRef.eri += n;
      }
    }

    if (operator === 'delete') {
      if (ri <= newRef.eri) {
        newRef.eri -= n;
        console.log('newRef.eri', newRef.eri);
      }

      if (ri === newRef.sri) {
        this.clear();
        return true;
      }
    }

    this.ref = newRef.toString();
    return oldRef !== this.ref;
  }

  // operator insert | delete
  shift(ref, ci, n = 1, operator = 'insert') {
    if (!ref) {
      return false;
    }

    const oldRef = this.ref;
    const newRef = CellRange.valueOf(ref);

    if (operator === 'insert') {
      if (ci <= newRef.sci) {
        newRef.sci += n;
      }

      if (ci <= newRef.eci) {
        newRef.eci += n;
      }

      this.filters.forEach((it) => {
        if (it.ci >= ci) {
          it.ci += n;
        }
      });
    }

    if (operator === 'delete') {
      if (ci <= newRef.eci) {
        newRef.eci -= n;
      }

      if (newRef.sci > newRef.eci) {
        this.clear();
        return true;
      }
    }

    this.ref = newRef.toString();

    return oldRef !== this.ref;
  }

  filteredRows(getCell) {
    const rset = new Set();
    const fset = new Set();
    if (this.active()) {
      const { sri, eri } = this.range();
      const { filters } = this;
      for (let ri = sri + 1; ri <= eri; ri += 1) {
        for (let i = 0; i < filters.length; i += 1) {
          const filter = filters[i];
          const cell = getCell(ri, filter.ci);
          const ctext = cell.text === null ? t('filter.empty') : cell.text;
          if (!filter.includes(String(ctext))) {
            rset.add(ri);
            break;
          } else {
            fset.add(ri);
          }
        }
      }
    }
    return { rset, fset };
  }

  items(ci, getCell) {
    const m = {};
    if (this.active()) {
      const { sri, eri } = this.range();
      for (let ri = sri + 1; ri <= eri; ri += 1) {
        const cell = getCell(ri, ci);
        const key = cell.text === null ? t('filter.empty') : cell.text;
        const cnt = (m[key] || 0) + 1;
        m[key] = cnt;
      }
    }
    return m;
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
