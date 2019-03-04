import Validator from './validator';

export default class DateValidator extends Validator {
  // operator: b, nb, lt, lte, gt, gte
  constructor(required, value, operator) {
    super(operator, value, /^\d{4}\/\d{1,2}\/\d{1,2}$/, operator);
  }

  parseValue(v) {
    return new Date(v);
  }
}
