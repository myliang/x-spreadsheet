import DropdownItem from './dropdown_item';
import DropdownAlign from '../dropdown_align';

export default class Align extends DropdownItem {
  constructor(event, value) {
    super(event, 'align', '', value);
  }

  dropdown() {
    const { value } = this;
    return new DropdownAlign(this.event, ['left', 'center', 'right'], value);
  }
}
