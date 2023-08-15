import Dropdown from './dropdown';
import { h } from './element';
import { baseFonts } from '../core/font';
import { cssPrefix } from '../config';

export default class DropdownFont extends Dropdown {
  constructor(event) {
    const nfonts = baseFonts.map(it => h('div', `${cssPrefix}-item`)
      .on('click', () => {
        this.setTitle(it.title);
        this.change(it);
      })
      .child(it.title));
    super(event, baseFonts[0].title, '160px', true, 'bottom-left', ...nfonts);
  }
}
