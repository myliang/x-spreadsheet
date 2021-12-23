import Modal from './modal';
import FormInput from './form_input';
import FormSelect from './form_select';
import FormField from './form_field';
import Button from './button';
import { t } from '../locale/locale';
import { h } from './element';
import { cssPrefix } from '../config';

const fieldLabelWidth = 100;

export default class ModalMOHValidation extends Modal {
  constructor() {
    const attributeField = new FormField( // value should be initialized
      new FormInput('280px', '2021/22 Q2 Actual, 2021/22 Q2 Budget, ...'),
      { required: true },
      `${t('MOHValidation.attributes')}`
    );
    const categoryField = new FormField(
      new FormInput('280px', 'Current Assets, Liabilities, ...'),
      { required: true },
      `${t('MOHValidation.categories')}`
    );
    const typeField = new FormField(
      new FormSelect('format',
        ['format', 'value', 'relative'],
        '100%',
        it => t(`MOHValidation.type.${it}`),
        it => this.criteriaSelected(it)),
      { required: true },
      `${t('MOHValidation.validationType')}:`,
      fieldLabelWidth,
    );

    // FORMAT type operators
    const formatTypeField = new FormField(
      new FormSelect('text',
        ['text', 'number'],
        '100%',
        it => t(`MOHValidation.formatType.${it}`),
        it => this.criteriaFormatSelected(it)),
      { required: true },
      `${t('MOHValidation.params')}`
    );
    const strLenField = new FormField(
      new FormInput('140px', 'Text length ex: <5, 12 >=1'),
      { required: true },
    );
    const numLenField = new FormField(
      new FormInput('140px', 'Length before decimal'),
      { required: true },
    ).hide();
    const decLenField = new FormField(
      new FormInput('140px', 'Length after decimal'),
      { required: true },
    ).hide();
    // VALUE type operators
    const ltField = new FormField(
      new FormInput('140px', 'Maximum value of number'),
      { required: true },
      `${t('MOHValidation.params')}`,
    ).hide();
    const gtField = new FormField(
      new FormInput('140px', 'Minimum value of number'),
    ).hide();
    // RELATIVE type operators
    const of = new FormField( // operator
      new FormSelect('be',
        ['be', 'nbe', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'],
        '160px',
        it => t(`dataValidation.operator.${it}`),
        it => this.criteriaOperatorSelected(it)),
      { required: true },
      `${t('MOHValidation.params')}`,
    );
    const minvf = new FormField( // min
      new FormInput('70px', '10'),
      { required: true },
    );
    const maxvf = new FormField( // max
      new FormInput('70px', '100'),
      { required: true, type: 'number' },
    );
    const vf = new FormField( // value
      new FormInput('70px', '10'),
      { required: true, type: 'number' },
    ).hide();
    const sheetField = new FormField( // sheetName
      new FormInput('70px', 'Balance Sheet'),
      { required: false, type: 'text' },
      `${t('MOHValidation.sheetLabel')}`,
    );

    super(t('contextmenu.moh-validation'), [
      h('div', `${cssPrefix}-form-fields`).children(
        attributeField.el,
      ),
      h('div', `${cssPrefix}-form-fields`).children(
        categoryField.el,
      ),
      h('div', `${cssPrefix}-form-fields`).children(
        of.el,
        minvf.el,
        maxvf.el,
        vf.el,
        sheetField.el,
      ),
      h('div', `${cssPrefix}-buttons`).children(
        new Button('cancel').on('click', () => this.btnClick('cancel')),
        new Button('remove').on('click', () => this.btnClick('remove')),
        new Button('save', 'primary').on('click', () => this.btnClick('save')),
      ),
    ]);
    this.attributeField = attributeField;
    this.categoryField = categoryField;
    this.of = of;
    this.minvf = minvf;
    this.maxvf = maxvf;
    this.vf = vf;
    this.sheetField = sheetField;
    this.change = () => {};
  }

  showVf(it) {
    const hint = it === 'date' ? '2018-11-12' : '10';
    const { vf } = this;
    vf.input.hint(hint);
    vf.show();
  }

  criteriaSelected(it) {
    const {
      of,
      minvf,
      maxvf,
      vf,
      sheetField,
    } = this;
    // it === 'format' | 'value' | 'relative'
    if (it === 'format') {
      of.hide();
      minvf.hide();
      maxvf.hide();
      vf.hide();
      sheetField.hide();
    } else if (it === 'value') {
      of.hide();
      minvf.hide();
      maxvf.hide();
      vf.hide();
      sheetField.hide();
    } else if (it === 'relative') {
      of.show();
      minvf.show();
      maxvf.show();
      vf.hide();
      sheetField.show();
    }
  }

  criteriaOperatorSelected(it) {
    if (!it) return;
    const {
      minvf, maxvf, vf,
    } = this;
    if (it === 'be' || it === 'nbe') {
      minvf.show();
      maxvf.show();
      vf.hide();
    } else {
      // vf.rule.type = type; WHAT
      if (null === 'date') {
        vf.hint('2018-11-12');
      } else {
        vf.hint('10');
      }
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
      this.hide();
    } else if (action === 'save') {
      // validate
      const attrs = ['attributeField', 'categoryField', 'typeField', 'formatTypeField',
        'strLenField', 'numLenField', 'decLenField', 'ltField', 'gtField', 'ofField', 'minvf',
        'maxvf', 'vf', 'sheetField'];
      for (let i = 0; i < attrs.length; i += 1) {
        const field = this[attrs[i]];
        // console.log('field:', field);
        if (field.isShow()) {
          // console.log('it:', it);
          if (!field.validate()) return;
        }
      }

      const ref = this.categoryField.val();
      const type = this.typeField.val();
      const operator = this.of.val();
      let value;
      if (type === 'relative') {
        if (operator === 'be' || operator === 'nbe') {
          value = [this.minvf.val(), this.maxvf.val()];
        } else {
          value = this.vf.val();
        }
      } else if (type === 'value') {
        value = [this.gtField.val(), this.ltField.val()];
      }
      // console.log(mode, ref, type, operator, value);
      this.change('save',
        mode,
        ref,
        {
          type, operator, required: false, value,
        });
      this.hide();
    }
  }

  // validation: { mode, ref, validator }
  setValue(v) {
    if (v) {
      const {
        categoryField, of, vf, minvf, maxvf,
      } = this;
      const {
        mode, ref, validator,
      } = v;
      const {
        type, operator, value,
      } = validator || { type: 'list' };
      categoryField.val(ref);
      of.val(operator);
      if (Array.isArray(value)) {
        minvf.val(value[0]);
        maxvf.val(value[1]);
      } else {
        vf.val(value || '');
      }
      this.criteriaSelected(type);
      this.criteriaOperatorSelected(operator);
    }
    this.show();
  }
}
