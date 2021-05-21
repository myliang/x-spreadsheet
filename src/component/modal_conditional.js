import Modal from './modal'
import FormInput from './form_input'
import FormSelect from './form_select'
import FormField from './form_field'
import Button from './button'
import { t } from '../locale/locale'
import { h } from './element'
import { cssPrefix } from '../config'
import { styles } from '../core/conditionformatter'
const styleList = Object.keys(styles).map(style => style.toString())

export default class ModalConditional extends Modal {
  constructor(ConditionFormatter) {
    console.log(ConditionFormatter)

    // will be range input
    const rf = new FormField(
      new FormInput('120px', 'E3 or E3:F:12'),
      { required: true, pattern: /^([A-Z]{1,2}[1-9]\d*)(:[A-Z]{1,2}[1-9]\d*)?$/ }
    )
    const mf = new FormField(
      // will select style
      new FormSelect(styleList[0],
        styleList,
        '100%',
        it => t(`conditionalFormatting.style.${it}`),
        it => this.styleSelected(it)),
        { required: true }
    );
    // value input eventually here

    super('Conditional Formatting: [type]', [
      h('div', `${cssPrefix}-form-fields`).children(
        rf.el,
        mf.el,
      ),
      h('div', `${cssPrefix}-buttons`).children(
        new Button('cancel').on('click', () => this.btnClick('cancel')),
        new Button('save', 'primary').on('click', () => this.btnClick('save'))
      )
    ])
    this.mf = mf
    this.rf = rf
    this.change = () => {}
    this.ConditionFormatter = ConditionFormatter
    this.style = styleList[0]
  }

  btnClick(action) {
    if (action === 'cancel') {
      this.hide()
    } else if (action === 'save') {
      // validation eventually
      this.change('save') // will this do anything??
      this.ConditionFormatter.addAboveAverage(20, 22, 1, 3, this.style)
      console.log(this.ConditionFormatter, this.style)
    }
  }

  setValue(v) {
    this.show();
  }

  styleSelected(style) {
    this.style = style
  }
}