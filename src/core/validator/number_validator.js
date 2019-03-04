import Validator from './validator';

export default class NumberValidator extends Validator {
  constructor(required, value, operator) {
    super(required, value, /(^\d+$)|(^\d+(\.\d{0,4})?$)/, operator);
  }

  parseValue(v) {
    return Number(v);
  }
}
