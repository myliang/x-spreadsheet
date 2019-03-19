import { h } from '../element';
import { cssPrefix } from '../../config';

// rule: { required: false, pattern: // }
export default class FormField {
  constructor(label, labelWidth, rule, ...eles) {
    this.label = h('label', '').css('width', `${labelWidth}px`).html(label);
    this.el = h('div', `${cssPrefix}-form-field`)
      .children(this.label, ...eles);
  }
}
