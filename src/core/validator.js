import { t } from '../locale/locale';
import helper from './helper';

const rules = {
  phone: /^[1-9]\d{10}$/,
  email: /w+([-+.]w+)*@w+([-.]w+)*.w+([-.]w+)*/,
};

export default class Validator {
  // operator: b|nb|eq|neq|lt|lte|gt|gte
  // type: date|number|list|phone|email
  constructor(type, required, value, operator) {
    this.required = required;
    this.value = value;
    this.type = type;
    this.operator = operator;
    this.message = '';
  }

  parseValue(v) {
    const { type } = this;
    if (type === 'date') {
      return new Date(v);
    }
    if (type === 'number') {
      return Number(v);
    }
    return v;
  }

  equals(other) {
    let flag = this.type === other.type
      && this.required === other.required
      && this.operator === other.operator;
    if (flag) {
      if (Array.isArray(this.value)) {
        flag = helper.arrayEquals(this.value, other.value);
      } else {
        flag = this.value === other.value;
      }
    }
    return flag;
  }

  setMessageIfFalse(flag, key, ...arg) {
    if (!flag) {
      this.message = t(`validation.${key}`, ...arg);
    }
    return flag;
  }

  validate(v) {
    const {
      required, operator, value, type,
    } = this;
    if (required && /^\s*$/.test(v)) {
      return this.setMessageIfFalse(false, 'required');
    }
    if (rules[type] && !rules[type].test(v)) {
      return this.setMessageIfFalse(false, 'notMatch');
    }
    if (type === 'list') {
      return value.split(',').includes(v);
    }
    if (operator) {
      const v1 = this.parseValue(v);
      if (operator === 'be') {
        const [min, max] = value;
        return this.setMessageIfFalse(
          v1 >= this.parseValue(min) && v1 <= this.parseValue(max),
          'between',
          min,
          max,
        );
      }
      if (operator === 'nbe') {
        const [min, max] = value;
        return this.setMessageIfFalse(
          v1 < this.parseValue(min) || v1 > this.parseValue(max),
          'notBetween',
          min,
          max,
        );
      }
      if (operator === 'eq') {
        return this.setMessageIfFalse(
          v1 === this.parseValue(value),
          'equal',
          value,
        );
      }
      if (operator === 'neq') {
        return this.setMessageIfFalse(
          v1 !== this.parseValue(value),
          'notEqual',
          value,
        );
      }
      if (operator === 'lt') {
        return this.setMessageIfFalse(
          v1 < this.parseValue(value),
          'lessThan',
          value,
        );
      }
      if (operator === 'lte') {
        return this.setMessageIfFalse(
          v1 <= this.parseValue(value),
          'lessThanEqual',
          value,
        );
      }
      if (operator === 'gt') {
        return this.setMessageIfFalse(
          v1 > this.parseValue(value),
          'greaterThan',
          value,
        );
      }
      if (operator === 'gte') {
        return this.setMessageIfFalse(
          v1 >= this.parseValue(value),
          'greaterThanEqual',
          value,
        );
      }
    }
    return true;
  }
}
