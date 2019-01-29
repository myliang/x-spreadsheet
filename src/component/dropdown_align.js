import Dropdown from './dropdown';
import { h } from './element';
import Icon from './icon';
import { cssPrefix } from '../config';

function buildItemWithIcon(iconName) {
  return h('div', `${cssPrefix}-item`).child(new Icon(iconName));
}

export default class DropdownAlign extends Dropdown {
  constructor(aligns, align) {
    const icon = new Icon(`align-${align}`);
    const naligns = aligns.map(it => buildItemWithIcon(`align-${it}`)
      .on('click', () => {
        this.setTitle(it);
        this.change(it);
      }));
    super(icon, 'auto', true, 'bottom-left', ...naligns);
  }

  setTitle(align) {
    this.title.setName(`align-${align}`);
    this.hide();
  }
}
