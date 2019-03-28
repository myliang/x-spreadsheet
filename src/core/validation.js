import { expr2xy } from './alphabet';
import Validator from './validator';
import { CellRange } from './cell_range';

class Validation {
  constructor(mode, ref, validator) {
    this.refs = [ref];
    this.mode = mode; // cell
    this.validator = validator;
  }

  addRef(ref) {
    const { refs } = this;
    refs.push(ref);
  }

  includes(ri, ci) {
    const { refs, mode } = this;
    const [x1, y1] = [ci, ri];
    for (let i = 0; i < refs.length; i += 1) {
      const exprs = refs[i].split(':');
      if (exprs.length > 1 && mode === 'cell') {
        const [sx, sy] = expr2xy(exprs[0]);
        const [ex, ey] = expr2xy(exprs[1]);
        if (sx <= x1 && x1 <= ex && sy <= y1 && y1 <= ey) return true;
      } else {
        const [x, y] = expr2xy(exprs[0]);
        if (mode === 'column') {
          if (x1 >= x) return true;
        } else if (mode === 'row') {
          if (y1 >= y) return true;
        } else if (x1 === x && y1 === y) return true;
      }
    }
    return false;
  }

  remove(cellRange) {
    const nrefs = [];
    this.refs.forEach((it) => {
      const cr = CellRange.valueOf(it);
      if (cr.intersects(cellRange)) {
        const crs = cr.difference(cellRange);
        crs.forEach(it1 => nrefs.push(it1.toString()));
      } else {
        nrefs.push(it);
      }
    });
    this.refs = nrefs;
  }
}
class Validations {
  constructor() {
    this._ = [];
  }

  // type: date|number|phone|email|list
  // validator: { required, value, operator }
  add(mode, ref, {
    type, required, value, operator,
  }) {
    const validator = new Validator(
      type, required, value, operator,
    );
    const v = this.getByValidator(validator);
    if (v !== null) {
      v.addRef(ref);
    } else {
      this._.push(new Validation(mode, ref, validator));
    }
  }

  getByValidator(validator) {
    for (let i = 0; i < this._.length; i += 1) {
      const v = this._[i];
      if (v.validator.equals(validator)) {
        return v;
      }
    }
    return null;
  }

  get(ri, ci) {
    for (let i = 0; i < this._.length; i += 1) {
      const v = this._[i].get(ri, ci);
      if (v !== null) return v;
    }
    return null;
  }

  remove(cellRange) {
    this.each((it) => {
      it.remove(cellRange);
    });
  }

  each(cb) {
    this._.forEach(it => cb(it));
  }

  getData() {
    return this._;
  }

  setData(d) {
    this._ = d;
  }
}

export default {};
export {
  Validations,
};
