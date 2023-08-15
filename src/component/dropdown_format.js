import Dropdown from './dropdown';
import { h } from './element';
import { baseFormats } from '../core/format';
import { cssPrefix } from '../config';

export default class DropdownFormat extends Dropdown {
  constructor() {
    let nformats = baseFormats.slice(0);
    nformats.splice(2, 0, { key: 'divider' });
    nformats.splice(8, 0, { key: 'divider' });
    nformats = nformats.map((it) => {
      const item = h('div', `${cssPrefix}-item`);
      if (it.key === 'divider') {
        item.addClass('divider');
      } else {
        item.child(it.title())
          .on('click', () => {
            this.setTitle(it.title());
            this.change(it);
          });
        if (it.label) item.child(h('div', 'label').html(it.label));
      }
      return item;
    });
    super('Normal', '220px', true, 'bottom-left', ...nformats);
  }

  setTitle(key) {
    for (let i = 0; i < baseFormats.length; i += 1) {
      if (baseFormats[i].key === key) {
        this.title.html(baseFormats[i].title());
      }
    }
    this.hide();
  }
}
