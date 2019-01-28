import Dropdown from './dropdown';
import { h } from './element';
import { baseFonts } from '../font';

export default class DropdownFont extends Dropdown {
  constructor() {
    const nfonts = baseFonts.map(it => h('div', 'xss-item')
      .on('click', () => {
        this.setTitle(it.title);
        this.change(it);
      })
      .child(it.title));
    super(baseFonts[0].title, '160px', true, 'bottom-left', ...nfonts);
  }
}
