import { h } from './element';
import { cssPrefix } from '../config';

export default class Checkbox {
  constructor(name) {
    this.vchange = () => { };
    this.input = h('input', '').attr('type', 'checkbox')
      .on('input', evt => this.vchange(evt));
    this.el = h('label', `${cssPrefix}-form-input`).children(
      this.input.el,
      h('span', '').html(name).css({ 'padding-left': '12px' }),
    ).css({ 'align-items': 'center' });
  }

  val() {
    return this.input.el.checked;
  }

  reset() {
    this.input.el.checked = false;
  }
}
