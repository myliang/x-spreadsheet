import Dropdown from './dropdown';
import { h } from './element';
import { fontSizes } from '../font';

export default class DropdownFontSize extends Dropdown {
  constructor() {
    const nfontSizes = fontSizes.map(it => h('div', 'xss-item')
      .on('click', () => {
        this.setTitle(`${it.pt}`);
        this.change(it);
      })
      .child(`${it.pt}`));
    super('10', '60px', true, ...nfontSizes);
  }
}
