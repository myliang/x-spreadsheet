import Validator from './validator';

export default class PhoneValidator extends Validator {
  constructor(required, value) {
    super(required, value, /^1[34578]\d{9}$/);
  }
}
