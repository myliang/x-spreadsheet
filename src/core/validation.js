import { expr2xy } from './alphabet';
import DateValidator from './validator/date_validator';
import NumberValidator from './validator/number_validator';
import ListValidator from './validator/list_validator';
import PhoneValidator from './validator/phone_validator';
import EmailValidator from './validator/email_validator';

class Validation {
  constructor(mode, ref, type, validator) {
    this.ref = ref;
    this.mode = mode; // column | row | range
    this.type = type; // date, number, ....
    this.validator = validator;
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
    let validator = new ListValidator(required, value);
    if (type === 'date') {
      validator = new DateValidator(required, value, operator);
    } else if (type === 'number') {
      validator = new NumberValidator(required, value, operator);
    } else if (type === 'phone') {
      validator = new PhoneValidator(required, value);
    } else if (type === 'email') {
      validator = new EmailValidator(required, value);
    }
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

  get(ref) {
    const [x1, y1] = expr2xy(ref);
    for (let i = 0; i < this._.length; i += 1) {
      this.cindex = i;
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
