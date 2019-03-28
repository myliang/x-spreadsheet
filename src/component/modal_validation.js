import Modal from './modal';
import FormInput from './form_input';
import FormSelect from './form_select';
import FormField from './form_field';
import Button from './button';
import { t } from '../locale/locale';
import { h } from './element';
import { cssPrefix } from '../config';

const fieldLabelWidth = 100;

export default class ModalValidation extends Modal {
  constructor() {
    const mf = new FormField(
      new FormSelect('cell',
        ['cell'], // cell|row|column
        '100%',
        it => t(`dataValidation.modeType.${it}`)),
      { required: true },
      `${t('dataValidation.range')}:`,
      fieldLabelWidth,
    );
    const rf = new FormField(
      new FormInput('120px', 'E3 or E3:F12'),
      { required: true, pattern: /^([A-Z]{1,2}[1-9]\d*)(:[A-Z]{1,2}[1-9]\d*)?$/ },
    );
    const cf = new FormField(
      new FormSelect('list',
        ['list', 'number', 'date', 'phone', 'email'],
        '100%',
        it => t(`dataValidation.type.${it}`),
        it => this.criteriaSelected(it)),
      { required: true },
      `${t('dataValidation.criteria')}:`,
      fieldLabelWidth,
    );

    // operator
    const of = new FormField(
      new FormSelect('be',
        ['be', 'nbe', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'],
        '160px',
        it => t(`dataValidation.operator.${it}`),
        it => this.criteriaOperatorSelected(it)),
      { required: true },
    ).hide();
    // min, max
    const minvf = new FormField(
      new FormInput('70px', '10'),
      { required: true },
    ).hide();
    const maxvf = new FormField(
      new FormInput('70px', '100'),
      { required: true, pattern: /(^\d+$)|(^\d+(\.\d{0,4})?$)/ },
    ).hide();
    // value
    const svf = new FormField(
      new FormInput('120px', 'a,b,c'),
      { required: true },
    );
    const vf = new FormField(
      new FormInput('70px', '10'),
      { required: true, pattern: /(^\d+$)|(^\d+(\.\d{0,4})?$)/ },
    ).hide();

    super(t('contextmenu.validation'), [
      h('div', `${cssPrefix}-form-fields`).children(
        mf.el,
        rf.el,
      ),
      h('div', `${cssPrefix}-form-fields`).children(
        cf.el,
        of.el,
        minvf.el,
        maxvf.el,
        vf.el,
        svf.el,
      ),
      h('div', `${cssPrefix}-buttons`).children(
        new Button('cancel').on('click', () => this.btnClick('cancel')),
        new Button('remove').on('click', () => this.btnClick('remove')),
        new Button('save', 'primary').on('click', () => this.btnClick('save')),
      ),
    ]);
    this.mf = mf;
    this.rf = rf;
    this.cf = cf;
    this.of = of;
    this.minvf = minvf;
    this.maxvf = maxvf;
    this.vf = vf;
    this.svf = svf;
    this.change = () => {};
  }

  showMinvf(it) {
    const hint = it === 'date' ? '2018-11-12' : '10';
    const { minvf } = this;
    minvf.input.hint(hint);
    minvf.show();
  }

  showMaxvf(it) {
    const hint = it === 'date' ? '2019-11-12' : '100';
    const { maxvf } = this;
    maxvf.input.hint(hint);
    maxvf.show();
  }

  showVf(it) {
    const hint = it === 'date' ? '2018-11-12' : '10';
    const { vf } = this;
    vf.input.attr('placeholder', hint);
    vf.show();
  }

  criteriaSelected(it) {
    const {
      of, minvf, maxvf, vf, svf,
    } = this;
    if (it === 'date' || it === 'number') {
      of.show();
      this.showMinvf(it);
      this.showMaxvf(it);
      vf.hide();
      svf.hide();
    } else {
      if (it === 'list') {
        svf.show();
      } else {
        svf.hide();
      }
      vf.hide();
      of.hide();
      minvf.hide();
      maxvf.hide();
    }
  }

  criteriaOperatorSelected(it) {
    const {
      minvf, maxvf, vf,
    } = this;
    if (it === 'be' || it === 'nbe') {
      minvf.show();
      maxvf.show();
      vf.hide();
    } else {
      vf.show();
      minvf.hide();
      maxvf.hide();
    }
  }

  btnClick(action) {
    if (action === 'cancel') {
      this.hide();
    } else if (action === 'remove') {
      this.change('remove');
    } else if (action === 'save') {
      const mode = this.mf.val();
      const ref = this.rf.val();
      const type = this.cf.val();
      const operator = this.of.val();
      let value = this.svf.val();
      if (type === 'number' || type === 'date') {
        if (operator === 'be' || operator === 'nbe') {
          value = [this.minvf.val(), this.maxvf.val()];
        } else {
          value = this.vf.val();
        }
      }
      this.change('save',
        mode,
        ref,
        type,
        { operator, required: false, value });
    }
  }

  // validation: { mode, ref, validator }
  setValue(v) {
    if (v) {
      const {
        mf, rf, cf, of,
      } = this;
      const {
        mode, ref, type, validator,
      } = v;
      const {
        operator,
      } = validator;
      mf.val(mode);
      rf.val(ref);
      cf.val(type);
      of.val(operator);
      this.crieriaSelected(operator);
    }
    this.show();
  }
}
