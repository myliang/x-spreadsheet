import Validator from './validator';

export default class EmailValidator extends Validator {
  constructor(required, value) {
    super(required, value, /w+([-+.]w+)*@w+([-.]w+)*.w+([-.]w+)*/);
  }
}
