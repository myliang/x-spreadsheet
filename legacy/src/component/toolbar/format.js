import DropdownItem from './dropdown_item';
import DropdownFormat from '../dropdown_format';

export default class Format extends DropdownItem {
  constructor() {
    super('format');
  }

  getValue(it) {
    return it.key;
  }

  dropdown() {
    return new DropdownFormat();
  }
}
