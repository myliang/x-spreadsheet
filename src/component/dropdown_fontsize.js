import Dropdown from './dropdown';
import { h } from './element';
import { fontSizes } from '../core/font';
import { cssPrefix } from '../config';

export default class DropdownFontSize extends Dropdown {
  constructor(event) {
    const nfontSizes = fontSizes.map(it => h('div', `${cssPrefix}-item`)
      .on('click', () => {
        this.setTitle(`${it.pt}`);
        this.change(it);
      })
      .child(`${it.pt}`));
    super(event, '10', '60px', true, 'bottom-left', ...nfontSizes);
  }
}
