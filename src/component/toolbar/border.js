import DropdownItem from './dropdown_item';
import DropdownBorder from '../dropdown_border';

export default class Border extends DropdownItem {
  constructor(event) {
    super(event, 'border');
  }

  dropdown() {
    return new DropdownBorder(this.event);
  }
}
