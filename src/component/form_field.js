import { h } from './element';
import { cssPrefix } from '../config';
import { t } from '../locale/locale';

// rule: { required: false, pattern: // }
export default class FormField {
  constructor(input, rule, label, labelWidth) {
    this.label = '';
    if (label) {
      this.label = h('label', 'label').css('width', `${labelWidth}px`).html(label);
    }
    this.tip = h('div', 'tip').hide();
    this.input = input;
    this.el = h('div', `${cssPrefix}-form-field`)
      .children(this.label, input.el, this.tip);
  }

  validate() {
    const { input, rule, tip } = this;
    const v = input.val();
    if (rule.required) {
      if (/^\s*$/.test(v)) {
        tip.html(t('validation.required'));
        return false;
      }
    }
    if (rule.pattern) {
      if (!rule.pattern.test(v)) {
        tip.html(t('validation.notMatch'));
        return false;
      }
    }
    return true;
  }
}
