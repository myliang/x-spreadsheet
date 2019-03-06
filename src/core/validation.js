import { expr2xy } from './alphabet';

class Validation {
  constructor(mode, ref, validator) {
    this.ref = ref;
    this.mode = mode; // column | row | range
    this.validator = validator;
  }
}
class Validations {
  constructor() {
    this._ = [];
  }

  add(mode, ref, validator) {
    const v = this.get(ref);
    if (v !== null && v.mode === mode) {
      v.validator = validator;
    } else {
      this._.push(new Validation(mode, ref, validator));
    }
  }

  get(ref) {
    const [x1, y1] = expr2xy(ref);
    for (let i = 0; i < this._.length; i += 1) {
      const v = this._[i];
      const exprs = v.ref.split(':');
      if (exprs.length > 1 && v.mode === 'range') {
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
