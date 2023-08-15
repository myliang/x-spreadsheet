import Dropdown from './dropdown';
import Icon from './icon';
import BorderPalette from './border_palette';

export default class DropdownBorder extends Dropdown {
  constructor(event) {
    const icon = new Icon('border-all');
    const borderPalette = new BorderPalette(event);
    borderPalette.change = (v) => {
      this.change(v);
      this.hide();
    };
    super(event, icon, 'auto', false, 'bottom-left', borderPalette.el);
  }
}
