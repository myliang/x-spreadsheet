import Dropdown from './dropdown';
import Icon from './icon';
import { h } from './element';
import { cssPrefix } from '../config';

import { SUPPORTED_FORMULAS } from 'hot-formula-parser';

export default class DropdownFormula extends Dropdown {
  constructor() {
    const nformulas = SUPPORTED_FORMULAS.map(it => h('div', `${cssPrefix}-item`)
      .on('click', () => {
        this.hide();
        this.change(it);
      })
      .child(it));
    super(new Icon('formula'), '180px', true, 'bottom-left limit-height', ...nformulas);
  }
}
