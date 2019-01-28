import Dropdown from './dropdown';
import Icon from './icon';
import ColorPalette from './color_palette';

export default class DropdownColor extends Dropdown {
  constructor(iconName, color) {
    const icon = new Icon(iconName)
      .css('height', '16px')
      .css('border-bottom', `3px solid ${color}`);
    const colorPalette = new ColorPalette();
    colorPalette.change = (v) => {
      this.setTitle(v);
      this.change(v);
    };
    super(icon, 'auto', false, 'bottom-left', colorPalette.el);
  }

  setTitle(color) {
    this.title.css('border-color', color);
    this.hide();
  }
}
