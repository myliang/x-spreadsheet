import Modal from './modal';
import FormInput from './form_input';
import FormSelect from './form_select';
import FormField from './form_field';
import { t } from '../locale/locale';
import { h } from './element';
import { cssPrefix } from '../config';

const fieldLabelWidth = 100;

export default class ModalValidation extends Modal {
  constructor() {
    const content = ``;
    const mf = new FormField(
      new FormSelect('cell', ['cell', 'column', 'row'], '70px'),
      { required: true },
      t('dataValidation.range') + ':',
      fieldLabelWidth,
    );
    const rf = new FormField(
      new FormInput('120px', 'E3 or E3:F12'),
    );
    const cf = new FormField(
      new FormSelect('list', ['list', 'number', 'date', 'phone', 'email'], '70px', (it) => {
        this.criteriaSelected(it);
      }),
      { required: true },
      t('dataValidation.criteria') + ':',
      fieldLabelWidth,
    );
    super(t('contextmenu.validation'), [
      h('div', `${cssPrefix}-form-fields`).children(
        mf.el,
        rf.el,
      ),
      h('div', `${cssPrefix}-form-fields`).children(
        cf.el,
      ),
    ]);
    this.mf = mf;
    this.rf = rf;
    this.cf = cf;
  }

  criteriaSelected(it) {
  }

  setValue(v) {
    this.show();
  }
}
