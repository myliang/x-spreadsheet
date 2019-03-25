import { t } from '../../locale/locale';

export default class Validator {
  // operator: b, nb, eq, neq, lt, lte, gt, gte
  constructor(required, value, rule, operator) {
    this.required = required;
    this.value = value;
    this.rule = rule;
    this.operator = operator;
    this.message = '';
  }

  parseValue(v) {
    return v;
  }

  setMessageIfFalse(flag, key, ...arg) {
    if (!flag) {
      this.message = t(`validation.${key}`, ...arg);
    }
    return flag;
  }

  validate(v) {
    const {
      required, operator, value, rule,
    } = this;
    if (required && /^\s*$/.test(v)) {
      return this.setMessageIfFalse(false, 'required');
    }
    if (rule && !rule.test(v)) {
      return this.setMessageIfFalse(false, 'notMatch');
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
