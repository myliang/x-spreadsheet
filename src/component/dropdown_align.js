import Dropdown from './dropdown';
import { h } from './element';
import Icon from './icon';

function buildItemWithIcon(iconName) {
  return h('div', 'xss-item').child(new Icon(iconName));
}

export default class DropdownAlign extends Dropdown {
  constructor(aligns, align) {
    const icon = new Icon(`align-${align}`);
    const naligns = aligns.map(it => buildItemWithIcon(`align-${it}`)
      .on('click', () => {
        this.setTitle(it);
      }));
    super(icon, 'auto', true, ...naligns);
  }

  setTitle(align) {
    this.title.className(`align-${align}`);
    this.hide();
  }
}
