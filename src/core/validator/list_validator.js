import Validator from './validator';

export default class ListValidator extends Validator {
  constructor(required, value) {
    super(required, value, undefined);
  }

  validate(v) {
    return this.value.split(',').includes(v);
  }
}
