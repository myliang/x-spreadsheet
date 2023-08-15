import DropdownItem from './dropdown_item';
import DropdownFormat from '../dropdown_format';

export default class Format extends DropdownItem {
  constructor(event) {
    super(event, 'format');
  }

  getValue(it) {
    return it.key;
  }

  dropdown() {
    return new DropdownFormat(this.event);
  }
}
