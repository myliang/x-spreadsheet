import { h } from './element';
import { cssPrefix } from '../config';

export default class FormInput {
  constructor(width, hint) {
    this.el = h('div', `${cssPrefix}-form-input`).css('width', width);
    this.input = h('input', '')
      .attr('placeholder', hint);
    this.el.child(this.input);
  }

  val(v) {
    return this.input.val(v);
  }
}
