import { expr2xy } from './alphabet';
import Validator from './validator';

class Validation {
  constructor(mode, type, validator) {
    this.refs = [];
    this.mode = mode; // column | row | range
    this.type = type; // date, number, ....
    this.validator = validator;
  }

  addRef(ref) {
    this.refs.push(ref);
  }
}
class Validations {
  constructor() {
    this._ = [];
    this.cindex = -1; // current index by the method of get
  }

  // type: date|number|phone|email|list
  // validator: { required, value, operator }
  add(mode, ref, type, { required, value, operator }) {
    const validator = new Validator(
      type, required, value, operator,
    );
    const v = this.get(ref);
    if (v !== null && v.mode === mode) {
      v.validator = validator;
    } else {
      this._.push(new Validation(mode, ref, type, validator));
    }
  }

  remove() {
    const { cindex } = this;
    if (cindex >= 0) {
      this._.splice(cindex, 1);
    }
  }

  get(ri, ci) {
    // const [x1, y1] = expr2xy(ref);
    const [x1, y1] = [ci, ri];
    for (let i = 0; i < this._.length; i += 1) {
      this.cindex = i;
      const v = this._[i];
      const exprs = v.ref.split(':');
      if (exprs.length > 1 && v.mode === 'cell') {
        const [sx, sy] = expr2xy(exprs[0]);
        const [ex, ey] = expr2xy(exprs[1]);
        if (sx <= x1 && x1 <= ex && sy <= y1 && y1 <= ey) return v;
      } else {
        const [x, y] = expr2xy(v.ref);
        if (v.mode === 'column') {
          if (x1 >= x) return v;
        } else if (v.mode === 'row') {
          if (y1 >= y) return v;
        } else if (x1 === x && y1 === y) return v;
      }
    }
    return null;
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
