import Dropdown from './dropdown';
import { h } from './element';
import { cssPrefix } from '../config';

export default class DropdownSearchOptions extends Dropdown {
  constructor() {
    const noptions = [
      { key: 'sheet', title: 'This sheet' },
      { key: 'range', title: 'Selected range' },
    ].map(it => h('div', `${cssPrefix}-item`)
      .on('click', () => {
        this.setTitle(it.title);
        this.change(it);
      })
      .child(it.title));
    super('This sheet', '160px', true, 'bottom-left', ...noptions);
  }
}
