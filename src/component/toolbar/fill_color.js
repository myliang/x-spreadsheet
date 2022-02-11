import DropdownItem from './dropdown_item';
import DropdownColor from '../dropdown_color';

export default class FillColor extends DropdownItem {
  constructor(event, color) {
    super(event, 'bgcolor', undefined, color);
  }

  dropdown() {
    const { tag, value } = this;
    return new DropdownColor(this.event, tag, value);
  }
}
