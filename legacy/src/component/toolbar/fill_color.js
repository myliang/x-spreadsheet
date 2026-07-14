import DropdownItem from './dropdown_item';
import DropdownColor from '../dropdown_color';

export default class FillColor extends DropdownItem {
  constructor(color) {
    super('bgcolor', undefined, color);
  }

  dropdown() {
    const { tag, value } = this;
    return new DropdownColor(tag, value);
  }
}
